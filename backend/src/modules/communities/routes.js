const express = require('express');
const { authenticateToken } = require('../../middlewares/auth');
const { generalRateLimiter } = require('../../middlewares/rateLimit');
const {
  createCommunityValidation,
  updateCommunityValidation,
  listCommunitiesValidation,
  getCommunityValidation,
  joinLeaveCommunityValidation,
  getModeratorsValidation,
  validate,
} = require('./validators');
const {
  createCommunity,
  getCommunity,
  listCommunities,
  updateCommunity,
  joinCommunity,
  leaveCommunity,
  getModerators,
  deleteCommunity,
} = require('./controller');
const postsController = require('../posts/controller');
const { getCommunityPostsValidation, validate: postsValidate } = require('../posts/validators');
const {
  getModerators: getModeratorsDetailed,
  addModerator,
  removeModerator,
  banUser,
  unbanUser,
  getBannedUsers,
} = require('./moderation.controller');
const { listMembers } = require('./controller');
const {
  addModeratorValidation,
  banUserValidation,
  paginationValidation,
  communityIdValidation,
  userIdValidation,
} = require('./moderation.validators');

const router = express.Router();
const directUpload = require('../../middlewares/directUpload');

/**
 * Communities API Routes
 * All routes are prefixed with /api/v1/communities
 */

// Create community (requires authentication)
router.post(
  '/',
  authenticateToken,
  generalRateLimiter,
  directUpload({ namespace: 'communities' }),
  createCommunityValidation,
  validate,
  createCommunity
);

// List communities (public, but can be filtered by user preferences)
router.get('/', listCommunitiesValidation, validate, listCommunities);

// Get community by ID (public)
router.get('/:id', getCommunityValidation, validate, getCommunity);

// Update community (requires authentication + ownership/moderation)
router.patch(
  '/:id',
  authenticateToken,
  generalRateLimiter,
  directUpload({ namespace: 'communities' }),
  updateCommunityValidation,
  validate,
  updateCommunity
);

// Join community (requires authentication)
router.post(
  '/:id/join',
  authenticateToken,
  generalRateLimiter,
  joinLeaveCommunityValidation,
  validate,
  joinCommunity
);

// Leave community (requires authentication)
router.post(
  '/:id/leave',
  authenticateToken,
  generalRateLimiter,
  joinLeaveCommunityValidation,
  validate,
  leaveCommunity
);

// Unified community membership toggle
// POST /api/v1/communities/:id/toggle-membership { action?: 'join'|'leave' } or just POST to toggle
router.post(
  '/:id/toggle-membership',
  authenticateToken,
  generalRateLimiter,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body;
      const userId = req.user.uid;

      // Check current membership status
      const { getFirestore } = require('../../../lib/firebase');
      const firestore = getFirestore();
      const membershipDoc = await firestore
        .collection('communities')
        .doc(id)
        .collection('members')
        .doc(userId)
        .get();

      const isCurrentlyMember = membershipDoc.exists;
      let shouldJoin;

      if (action) {
        // Explicit action provided
        shouldJoin = action === 'join';
      } else {
        // Toggle based on current state
        shouldJoin = !isCurrentlyMember;
      }

      if (shouldJoin && !isCurrentlyMember) {
        // Join the community
        return joinCommunity(req, res);
      } else if (!shouldJoin && isCurrentlyMember) {
        // Leave the community
        return leaveCommunity(req, res);
      } else {
        // Already in desired state
        res.json({
          ok: true,
          data: {
            communityId: id,
            member: shouldJoin,
            message: `You are already ${shouldJoin ? 'a member' : 'not a member'}`
          }
        });
      }
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: { code: 'MEMBERSHIP_TOGGLE_FAILED', message: 'Failed to toggle membership' }
      });
    }
  }
);

// Get community moderators (public)
router.get('/:id/moderators', getModeratorsValidation, validate, getModerators);
// List members
router.get('/:id/members', validate, listMembers);

// Community posts for community page
router.get(
  '/:communityId/posts',
  authenticateToken,
  generalRateLimiter,
  getCommunityPostsValidation,
  postsValidate,
  postsController.getCommunityPosts
);

// Delete community (owner or admin)
router.delete(
  '/:id',
  authenticateToken,
  generalRateLimiter,
  getCommunityValidation,
  validate,
  deleteCommunity
);

// Moderation Routes
/**
 * @swagger
 * /api/v1/communities/{id}/moderators:
 *   get:
 *     summary: Get community moderators with details
 *     tags: [Community Moderation]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of moderators per page
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor
 *     responses:
 *       200:
 *         description: Moderators retrieved successfully
 *       404:
 *         description: Community not found
 */
router.get(
  '/:id/moderators/detailed',
  authenticateToken,
  communityIdValidation,
  paginationValidation,
  validate,
  getModeratorsDetailed
);

/**
 * @swagger
 * /api/v1/communities/{id}/moderators:
 *   post:
 *     summary: Add a moderator to a community
 *     tags: [Community Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID to make moderator
 *     responses:
 *       201:
 *         description: Moderator added successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Community not found
 */
router.post(
  '/:id/moderators',
  authenticateToken,
  generalRateLimiter,
  communityIdValidation,
  addModeratorValidation,
  validate,
  addModerator
);

/**
 * @swagger
 * /api/v1/communities/{id}/moderators/{userId}:
 *   delete:
 *     summary: Remove a moderator from a community
 *     tags: [Community Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to remove as moderator
 *     responses:
 *       200:
 *         description: Moderator removed successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Community not found
 */
router.delete(
  '/:id/moderators/:userId',
  authenticateToken,
  generalRateLimiter,
  communityIdValidation,
  userIdValidation,
  validate,
  removeModerator
);

/**
 * @swagger
 * /api/v1/communities/{id}/ban:
 *   post:
 *     summary: Ban a user from a community
 *     tags: [Community Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID to ban
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for ban
 *     responses:
 *       201:
 *         description: User banned successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Community not found
 */
router.post(
  '/:id/ban',
  authenticateToken,
  generalRateLimiter,
  communityIdValidation,
  banUserValidation,
  validate,
  banUser
);

/**
 * @swagger
 * /api/v1/communities/{id}/ban/{userId}:
 *   delete:
 *     summary: Unban a user from a community
 *     tags: [Community Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to unban
 *     responses:
 *       200:
 *         description: User unbanned successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Community or user not found
 */
router.delete(
  '/:id/ban/:userId',
  authenticateToken,
  generalRateLimiter,
  communityIdValidation,
  userIdValidation,
  validate,
  unbanUser
);

/**
 * @swagger
 * /api/v1/communities/{id}/banned:
 *   get:
 *     summary: Get banned users from a community
 *     tags: [Community Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Community ID
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of banned users per page
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor
 *     responses:
 *       200:
 *         description: Banned users retrieved successfully
 *       404:
 *         description: Community not found
 */
router.get(
  '/:id/banned',
  authenticateToken,
  communityIdValidation,
  paginationValidation,
  validate,
  getBannedUsers
);

module.exports = router;
