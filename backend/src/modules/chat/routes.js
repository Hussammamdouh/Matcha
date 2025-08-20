const express = require('express');
const { authenticateToken } = require('../../middlewares/auth');
const { typingPresenceLimiter } = require('../../lib/chat/rateLimits');
const conversationRoutes = require('./conversations/routes');
const messageRoutes = require('./messages/routes');
const blocksRoutes = require('./blocks/routes');
const reportsRoutes = require('./reports/routes');
const presenceService = require('./presence/service');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PresenceUpdate:
 *       type: object
 *       properties:
 *         state:
 *           type: string
 *           enum: [online, offline]
 *           description: User's presence state
 *       required:
 *         - state
 *     
 *     TypingUpdate:
 *       type: object
 *       properties:
 *         isTyping:
 *           type: boolean
 *           description: Whether user is typing
 *       required:
 *         - isTyping
 *     
 *     ReadReceipt:
 *       type: object
 *       properties:
 *         at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when conversation was read
 */

// Apply authentication to all routes
router.use(authenticateToken);

// Mount conversation routes
router.use('/conversations', conversationRoutes);

// Mount message routes
router.use('/messages', messageRoutes);

// Mount blocks routes
router.use('/blocks', blocksRoutes);

// Mount reports routes
router.use('/reports', reportsRoutes);

/**
 * @swagger
 * /api/v1/chat/presence/heartbeat:
 *   post:
 *     summary: Update user presence
 *     description: Update user's online/offline status
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PresenceUpdate'
 *     responses:
 *       200:
 *         description: Presence updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PresenceUpdate'
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
// Presence and typing endpoints
router.post('/presence/heartbeat', typingPresenceLimiter, async (req, res) => {
  try {
    const { state } = req.body;
    const userId = req.user.uid;

    const presence = await presenceService.updatePresence(userId, state);

    res.json({
      ok: true,
      data: presence,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update presence',
      },
    });
  }
});

/**
 * @swagger
 * /api/v1/chat/conversations/{id}/typing:
 *   post:
 *     summary: Update typing status
 *     description: Set user's typing status in a conversation
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TypingUpdate'
 *     responses:
 *       200:
 *         description: Typing status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/TypingUpdate'
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
 *       429:
 *         description: Rate limited
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/conversations/:id/typing', typingPresenceLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { isTyping } = req.body;
    const userId = req.user.uid;

    if (typeof isTyping !== 'boolean') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'isTyping must be a boolean',
        },
      });
    }

    await presenceService.setTypingStatus(id, userId, isTyping);

    res.json({
      ok: true,
      data: { isTyping },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update typing status',
      },
    });
  }
});

/**
 * @swagger
 * /api/v1/chat/conversations/{id}/read:
 *   post:
 *     summary: Mark conversation as read
 *     description: Update user's last read timestamp in a conversation
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
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReadReceipt'
 *     responses:
 *       200:
 *         description: Read receipt updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ReadReceipt'
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
router.post('/conversations/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const { at } = req.body;
    const userId = req.user.uid;

    const readAt = at ? new Date(at) : null;
    await presenceService.markAsRead(id, userId, readAt);

    res.json({
      ok: true,
      data: { at: readAt || new Date() },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark as read',
      },
    });
  }
});

module.exports = router;
