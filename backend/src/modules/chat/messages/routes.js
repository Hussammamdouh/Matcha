const express = require('express');
const { authenticateToken } = require('../../../middlewares/auth');
const { 
  sendMessageLimiter, 
  sendMessageDailyLimiter 
} = require('../../../lib/chat/rateLimits');
const {
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
} = require('./controller');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     SendMessage:
 *       type: object
 *       properties:
 *         conversationId:
 *           type: string
 *           description: Conversation ID to send message to
 *         type:
 *           type: string
 *           enum: [text, image, audio]
 *           description: Message type
 *         text:
 *           type: string
 *           maxLength: 5000
 *           description: Message text (required for text messages)
 *         media:
 *           type: object
 *           properties:
 *             url:
 *               type: string
 *             mime:
 *               type: string
 *             size:
 *               type: number
 *             width:
 *               type: number
 *             height:
 *               type: number
 *             durationMs:
 *               type: number
 *           description: Media information (required for media messages)
 *         replyToMessageId:
 *           type: string
 *           description: ID of message being replied to
 *       required:
 *         - conversationId
 *         - type
 *     
 *     EditMessage:
 *       type: object
 *       properties:
 *         text:
 *           type: string
 *           maxLength: 5000
 *           description: New message text
 *       required:
 *         - text
 *     
 *     AddReaction:
 *       type: object
 *       properties:
 *         value:
 *           type: string
 *           description: Emoji reaction value
 *       required:
 *         - value
 */

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/v1/chat/messages:
 *   post:
 *     summary: Send message
 *     description: Send a text, image, or audio message to a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMessage'
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ChatMessage'
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
 *       403:
 *         description: Forbidden - not a participant or blocked
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
 *       429:
 *         description: Rate limited
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Send message (with rate limiting)
router.post(
  '/',
  sendMessageLimiter,
  sendMessageDailyLimiter,
  sendMessage
);

/**
 * @swagger
 * /api/v1/chat/messages/conversation/{conversationId}:
 *   get:
 *     summary: Get conversation messages
 *     description: Get messages in a conversation with pagination
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
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
 *           maximum: 50
 *           default: 50
 *         description: Number of messages to return
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Message order (asc = oldest first, desc = newest first)
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
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
 *                     $ref: '#/components/schemas/ChatMessage'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     hasMore:
 *                       type: boolean
 *                       description: Whether there are more messages
 *                     nextCursor:
 *                       type: string
 *                       description: Cursor for next page
 *                     conversationId:
 *                       type: string
 *                       description: Conversation ID
 *                     order:
 *                       type: string
 *                       description: Message order used
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
// Get messages in a conversation
router.get(
  '/conversation/:conversationId',
  getMessages
);

// Edit message
router.patch(
  '/:id',
  sendMessageLimiter,
  editMessage
);

// Delete message
router.delete(
  '/:id',
  deleteMessage
);

// Add reaction
router.post(
  '/:id/reactions',
  sendMessageLimiter,
  addReaction
);

// Remove reaction
router.delete(
  '/:id/reactions/:value',
  removeReaction
);

module.exports = router;
