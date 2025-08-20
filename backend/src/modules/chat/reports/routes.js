const express = require('express');
const { authenticateToken } = require('../../../middlewares/auth');
const { reportLimiter } = require('../../../lib/chat/rateLimits');
const {
  createReportValidation,
  getReportsValidation,
  getReportValidation,
  updateReportStatusValidation,
  validate,
} = require('./validators');
const {
  createReport,
  getReports,
  getReport,
  updateReportStatus,
} = require('./controller');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateChatReport:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [message, conversation, user]
 *           description: Type of report
 *         targetId:
 *           type: string
 *           description: ID of reported target (message, conversation, or user)
 *         conversationId:
 *           type: string
 *           description: Conversation ID (required for message reports)
 *         reasonCode:
 *           type: string
 *           enum: [spam, harassment, inappropriate_content, violence, fake_news, copyright, other]
 *           description: Reason for report
 *         note:
 *           type: string
 *           maxLength: 500
 *           description: Additional notes about the report
 *       required:
 *         - type
 *         - targetId
 *         - reasonCode
 *     
 *     UpdateReportStatus:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [in_review, resolved, dismissed]
 *           description: New report status
 *         resolutionNote:
 *           type: string
 *           maxLength: 500
 *           description: Note about resolution
 *       required:
 *         - status
 */

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/v1/chat/reports:
 *   post:
 *     summary: Create chat report
 *     description: Report a message, conversation, or user for moderation
 *     tags: [Chat Moderation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateChatReport'
 *     responses:
 *       201:
 *         description: Report created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ChatReport'
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
// Create a chat report
router.post('/', reportLimiter, createReportValidation, validate, createReport);

// Get chat reports (admin/moderator only)
router.get('/', getReportsValidation, validate, getReports);

// Get a specific chat report (admin/moderator only)
router.get('/:id', getReportValidation, validate, getReport);

// Update report status (admin/moderator only)
router.patch('/:id/status', reportLimiter, updateReportStatusValidation, validate, updateReportStatus);

module.exports = router;
