const express = require('express');
const { authenticateToken } = require('../../../middlewares/auth');
const { 
  createConversationLimiter, 
  createConversationDailyLimiter 
} = require('../../../lib/chat/rateLimits');
const {
  createConversationValidation,
  getConversationValidation,
  listConversationsValidation,
  joinConversationValidation,
  leaveConversationValidation,
  updateConversationValidation,
  toggleMuteValidation,
  validate,
} = require('./validators');
const {
  createConversation,
  getConversation,
  listConversations,
  joinConversation,
  leaveConversation,
  updateConversation,
  toggleMute,
} = require('./controller');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateDirectConversation:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [direct]
 *           description: Conversation type
 *         memberUserId:
 *           type: string
 *           description: User ID to start conversation with
 *       required:
 *         - type
 *         - memberUserId
 *     
 *     CreateGroupConversation:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [group]
 *           description: Conversation type
 *         title:
 *           type: string
 *           maxLength: 80
 *           description: Group conversation title
 *         memberUserIds:
 *           type: array
 *           items:
 *             type: string
 *           minItems: 2
 *           description: Array of user IDs to add to group
 *       required:
 *         - type
 *         - title
 *         - memberUserIds
 *     
 *     UpdateConversation:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           maxLength: 80
 *           description: New conversation title
 *         icon:
 *           type: string
 *           description: New conversation icon URL
 *         isLocked:
 *           type: boolean
 *           description: Whether to lock/unlock conversation
 *     
 *     ToggleMute:
 *       type: object
 *       properties:
 *         isMuted:
 *           type: boolean
 *           description: Whether to mute or unmute
 *       required:
 *         - isMuted
 */

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/v1/chat/conversations:
 *   post:
 *     summary: Create conversation
 *     description: Create a new direct or group conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/CreateDirectConversation'
 *               - $ref: '#/components/schemas/CreateGroupConversation'
 *     responses:
 *       201:
 *         description: Conversation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ChatConversation'
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
// Create conversation (with rate limiting)
router.post(
  '/',
  createConversationLimiter,
  createConversationDailyLimiter,
  createConversationValidation,
  validate,
  createConversation
);

/**
 * @swagger
 * /api/v1/chat/conversations/{id}:
 *   get:
 *     summary: Get conversation
 *     description: Get conversation details and participant list
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ChatConversation'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - not a participant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Get conversation
router.get(
  '/:id',
  getConversationValidation,
  validate,
  getConversation
);

/**
 * @swagger
 * /api/v1/chat/conversations:
 *   get:
 *     summary: List conversations
 *     description: Get user's conversations ordered by last message time
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 20
 *         description: Number of conversations to return
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ChatConversation'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     hasMore:
 *                       type: boolean
 *                       description: Whether there are more conversations
 *                     nextCursor:
 *                       type: string
 *                       description: Cursor for next page
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// List conversations
router.get(
  '/',
  listConversationsValidation,
  validate,
  listConversations
);

// Join conversation
router.post(
  '/:id/join',
  joinConversationValidation,
  validate,
  joinConversation
);

// Leave conversation
router.post(
  '/:id/leave',
  leaveConversationValidation,
  validate,
  leaveConversation
);

// Update conversation (moderators/owners only)
router.patch(
  '/:id',
  updateConversationValidation,
  validate,
  updateConversation
);

// Toggle mute status
router.post(
  '/:id/mute',
  toggleMuteValidation,
  validate,
  toggleMute
);

module.exports = router;
