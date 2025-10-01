const express = require('express');
const { authenticateToken } = require('../../../middlewares/auth');
const { generalRateLimiter } = require('../../../middlewares/rateLimit');
const directUpload = require('../../../middlewares/directUpload');
const {
  createOrGetConversation,
  getConversation,
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
  markAsRead,
  getConversations,
  updateTyping,
  getTypingUsers,
  unifiedOperation,
} = require('./controller');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @swagger
 * components:
 *   schemas:
 *     Conversation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Conversation ID
 *         type:
 *           type: string
 *           enum: [direct, group]
 *           description: Conversation type
 *         title:
 *           type: string
 *           description: Conversation title (for groups)
 *         participants:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               user:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   nickname:
 *                     type: string
 *                   avatar:
 *                     type: string
 *                   isOnline:
 *                     type: boolean
 *         messages:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Message'
 *         lastMessageAt:
 *           type: string
 *           format: date-time
 *         lastMessagePreview:
 *           type: string
 *         unreadCount:
 *           type: number
 *     
 *     Message:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Message ID
 *         conversationId:
 *           type: string
 *         authorId:
 *           type: string
 *         type:
 *           type: string
 *           enum: [text, image, audio, video]
 *         text:
 *           type: string
 *         media:
 *           type: object
 *         replyTo:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         isEdited:
 *           type: boolean
 *         isDeleted:
 *           type: boolean
 *         reactions:
 *           type: object
 */

/**
 * @swagger
 * /api/v1/chat/conversation:
 *   post:
 *     summary: Create or get conversation
 *     description: Create a new conversation or get existing one
 *     tags: [Unified Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of participant user IDs
 *               type:
 *                 type: string
 *                 enum: [direct, group]
 *                 default: direct
 *               title:
 *                 type: string
 *                 description: Conversation title (for groups)
 *             required:
 *               - participantIds
 *     responses:
 *       201:
 *         description: Conversation created or retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Conversation'
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Internal server error
 */
router.post('/conversation', generalRateLimiter, createOrGetConversation);

/**
 * @swagger
 * /api/v1/chat/conversations:
 *   get:
 *     summary: Get user's conversations
 *     description: Get list of user's conversations with preview
 *     tags: [Unified Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of conversations to return
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor
 *     responses:
 *       200:
 *         description: Conversations list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Conversation'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     hasMore:
 *                       type: boolean
 *                     total:
 *                       type: number
 */
router.get('/conversations', generalRateLimiter, getConversations);

/**
 * @swagger
 * /api/v1/chat/conversation/{id}:
 *   get:
 *     summary: Get conversation with messages
 *     description: Get full conversation details with message history
 *     tags: [Unified Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of messages to return
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor for messages
 *     responses:
 *       200:
 *         description: Conversation with messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Conversation'
 *       403:
 *         description: Not a participant
 *       404:
 *         description: Conversation not found
 */
router.get('/conversation/:id', generalRateLimiter, getConversation);

/**
 * @swagger
 * /api/v1/chat/conversation/{id}/message:
 *   post:
 *     summary: Send message
 *     description: Send a message to a conversation
 *     tags: [Unified Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [text, image, audio, video]
 *                 default: text
 *               text:
 *                 type: string
 *                 description: Message text content
 *               media:
 *                 type: object
 *                 description: Media information for non-text messages
 *               replyTo:
 *                 type: string
 *                 description: ID of message being replied to
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *                 description: Message text content (optional for media messages)
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Media file to upload (image, audio, or video)
 *               replyTo:
 *                 type: string
 *                 description: ID of message being replied to
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
 *                 data:
 *                   $ref: '#/components/schemas/Message'
 *       403:
 *         description: Not a participant
 */
router.post('/conversation/:id/message', directUpload({ namespace: 'chat' }), generalRateLimiter, sendMessage);

/**
 * @swagger
 * /api/v1/chat/conversation/{id}/messages:
 *   get:
 *     summary: Get messages in conversation
 *     description: Get messages in a conversation with pagination
 *     tags: [Unified Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of messages to return
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Messages list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     hasMore:
 *                       type: boolean
 *                     nextCursor:
 *                       type: string
 *                     total:
 *                       type: number
 */
router.get('/conversation/:id/messages', generalRateLimiter, getMessages);

/**
 * @swagger
 * /api/v1/chat/conversation/{id}/read:
 *   post:
 *     summary: Mark conversation as read
 *     description: Mark all messages in conversation as read
 *     tags: [Unified Chat]
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
 *         description: Successfully marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 */
router.post('/conversation/:id/read', generalRateLimiter, markAsRead);

/**
 * @swagger
 * /api/v1/chat/conversation/{id}/typing:
 *   post:
 *     summary: Update typing status
 *     description: Set user's typing status in conversation
 *     tags: [Unified Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isTyping:
 *                 type: boolean
 *                 description: Whether user is typing
 *             required:
 *               - isTyping
 *     responses:
 *       200:
 *         description: Typing status updated
 *       400:
 *         description: Invalid request
 */
router.post('/conversation/:id/typing', generalRateLimiter, updateTyping);

/**
 * @swagger
 * /api/v1/chat/conversation/{id}/typing:
 *   get:
 *     summary: Get typing users
 *     description: Get list of users currently typing in conversation
 *     tags: [Unified Chat]
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
 *         description: List of typing users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     typingUsers:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Array of user IDs currently typing
 */
router.get('/conversation/:id/typing', generalRateLimiter, getTypingUsers);

/**
 * @swagger
 * /api/v1/chat/message/{id}:
 *   patch:
 *     summary: Edit message
 *     description: Edit a message (within 15 minutes of creation)
 *     tags: [Unified Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *                 description: New message text
 *             required:
 *               - text
 *     responses:
 *       200:
 *         description: Message edited successfully
 *       403:
 *         description: Not authorized to edit this message
 *       400:
 *         description: Edit window expired or invalid request
 */
router.patch('/message/:id', generalRateLimiter, editMessage);

/**
 * @swagger
 * /api/v1/chat/message/{id}:
 *   delete:
 *     summary: Delete message
 *     description: Delete a message (soft delete)
 *     tags: [Unified Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *       403:
 *         description: Not authorized to delete this message
 */
router.delete('/message/:id', generalRateLimiter, deleteMessage);

/**
 * @swagger
 * /api/v1/chat/operation:
 *   post:
 *     summary: Unified chat operation
 *     description: Perform any chat operation through a single endpoint (for mobile convenience)
 *     tags: [Unified Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               operation:
 *                 type: string
 *                 enum: [create_conversation, get_conversation, send_message, get_messages, edit_message, delete_message, mark_read, get_conversations, update_typing]
 *                 description: The operation to perform
 *               data:
 *                 type: object
 *                 description: Operation-specific data
 *             required:
 *               - operation
 *     responses:
 *       200:
 *         description: Operation completed successfully
 *       400:
 *         description: Invalid operation or data
 *       500:
 *         description: Operation failed
 */
router.post('/operation', directUpload({ namespace: 'chat' }), generalRateLimiter, unifiedOperation);

module.exports = router;
