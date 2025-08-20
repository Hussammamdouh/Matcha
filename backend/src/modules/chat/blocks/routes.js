const express = require('express');
const { authenticateToken } = require('../../../middlewares/auth');
const { blockLimiter } = require('../../../lib/chat/rateLimits');
const {
  blockUserValidation,
  unblockUserValidation,
  getBlockedUsersValidation,
  validate,
} = require('./validators');
const {
  blockUser,
  unblockUser,
  getBlockedUsers,
} = require('./controller');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     BlockUser:
 *       type: object
 *       properties:
 *         blockedUserId:
 *           type: string
 *           description: User ID to block
 *       required:
 *         - blockedUserId
 */

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/v1/chat/blocks:
 *   post:
 *     summary: Block a user
 *     description: Block a user to prevent them from sending messages or starting conversations
 *     tags: [Chat Moderation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BlockUser'
 *     responses:
 *       200:
 *         description: User blocked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: 'User blocked successfully'
 *                     blockedUserId:
 *                       type: string
 *                       description: ID of blocked user
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Rate limited
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Block a user
router.post('/', blockLimiter, blockUserValidation, validate, blockUser);

// Unblock a user
router.delete('/:blockedUserId', blockLimiter, unblockUserValidation, validate, unblockUser);

// Get list of blocked users
router.get('/', getBlockedUsersValidation, validate, getBlockedUsers);

module.exports = router;
