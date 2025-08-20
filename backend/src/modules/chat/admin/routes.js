const express = require('express');
const { authenticateToken } = require('../../../middlewares/auth');
const { reportLimiter } = require('../../../lib/chat/rateLimits');
const { isAdmin, isModerator } = require('../../../lib/auth/permissions');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminChatReport:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Report ID
 *         type:
 *           type: string
 *           enum: [message, conversation, user]
 *           description: Report type
 *         targetId:
 *           type: string
 *           description: ID of reported target
 *         conversationId:
 *           type: string
 *           description: Conversation ID (if applicable)
 *         reasonCode:
 *           type: string
 *           enum: [spam, harassment, inappropriate_content, violence, fake_news, copyright, other]
 *           description: Reason for report
 *         status:
 *           type: string
 *           enum: [new, in_review, resolved, dismissed]
 *           description: Report status
 *         reporterId:
 *           type: string
 *           description: ID of user who created the report
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Report creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Report last update timestamp
 *         reviewerId:
 *           type: string
 *           description: ID of admin/moderator who reviewed the report
 *         resolutionNote:
 *           type: string
 *           description: Note about resolution
 */

// Apply authentication to all routes
router.use(authenticateToken);

// Admin/moderator only middleware
const requireAdminOrMod = async (req, res, next) => {
  try {
    const user = req.user;
    const isUserAdmin = await isAdmin(user.uid);
    const isUserModerator = await isModerator(user.uid);

    if (!isUserAdmin && !isUserModerator) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin or moderator access required',
        },
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to verify permissions',
      },
    });
  }
};

// Apply admin/moderator check to all routes
router.use(requireAdminOrMod);

/**
 * @swagger
 * /api/v1/admin/chat/reports:
 *   get:
 *     summary: Get chat reports (Admin/Moderator only)
 *     description: Retrieve chat reports for moderation with filtering and pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [new, in_review, resolved, dismissed]
 *         description: Filter by report status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [message, conversation, user]
 *         description: Filter by report type
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
 *           default: 20
 *         description: Number of reports to return
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
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
 *                     $ref: '#/components/schemas/AdminChatReport'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     hasMore:
 *                       type: boolean
 *                       description: Whether there are more reports
 *                     nextCursor:
 *                       type: string
 *                       description: Cursor for next page
 *                     total:
 *                       type: number
 *                       description: Total number of reports
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - admin/moderator access required
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
// Chat reports management
router.get('/chat/reports', reportLimiter, async (req, res) => {
  try {
    const { status, type, cursor, pageSize = 20 } = req.query;
    
    // This would call the reports service with admin privileges
    // For now, return a placeholder response
    res.json({
      ok: true,
      data: [],
      meta: {
        hasMore: false,
        nextCursor: null,
        total: 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get chat reports',
      },
    });
  }
});

// Resolve chat report
router.patch('/chat/reports/:id/resolve', reportLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;
    const reviewerId = req.user.uid;

    // This would call the reports service to update status
    // For now, return a placeholder response
    res.json({
      ok: true,
      data: {
        id,
        status,
        resolutionNote,
        reviewerId,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to resolve report',
      },
    });
  }
});

// Remove chat message (admin/moderator action)
router.delete('/chat/messages/:id', reportLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const moderatorId = req.user.uid;

    // This would call the messages service to remove the message
    // For now, return a placeholder response
    res.json({
      ok: true,
      data: {
        message: 'Message removed successfully',
        messageId: id,
        removedBy: moderatorId,
        removedAt: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to remove message',
      },
    });
  }
});

// Ban user from conversation (admin/moderator action)
router.post('/chat/conversations/:id/ban/:userId', reportLimiter, async (req, res) => {
  try {
    const { id: conversationId, userId } = req.params;
    const moderatorId = req.user.uid;

    // This would call the conversations service to ban the user
    // For now, return a placeholder response
    res.json({
      ok: true,
      data: {
        message: 'User banned successfully',
        conversationId,
        bannedUserId: userId,
        bannedBy: moderatorId,
        bannedAt: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to ban user',
      },
    });
  }
});

// Lock/unlock conversation (admin/moderator action)
router.post('/chat/conversations/:id/lock', reportLimiter, async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const { isLocked } = req.body;
    const moderatorId = req.user.uid;

    // This would call the conversations service to lock/unlock
    // For now, return a placeholder response
    res.json({
      ok: true,
      data: {
        message: `Conversation ${isLocked ? 'locked' : 'unlocked'} successfully`,
        conversationId,
        isLocked,
        updatedBy: moderatorId,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update conversation lock status',
      },
    });
  }
});

module.exports = router;
