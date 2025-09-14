const express = require('express');
const { authenticateToken } = require('../../middlewares/auth');
const { generalRateLimiter } = require('../../middlewares/rateLimit');
const {
  createReportValidation,
  updateReportValidation,
  getReportValidation,
  listReportsValidation,
  getUserReportsValidation,
  validate,
} = require('./validators');
const {
  createReport,
  getReport,
  updateReport,
  listReports,
  getUserReports,
  getReportStats,
  getContentReports,
} = require('./controller');

const router = express.Router();

/**
 * Reports API Routes
 * All routes are prefixed with /api/v1/reports
 */

// Create report (requires authentication)
router.post(
  '/',
  authenticateToken,
  generalRateLimiter,
  createReportValidation,
  validate,
  createReport
);

// Unified report creation endpoint - handles all report types
// POST /api/v1/reports/create { surface: 'feed'|'chat'|'men', entityType: 'post'|'comment'|'message'|'user', entityId: '...', reason: '...', details?: '...' }
router.post(
  '/create',
  authenticateToken,
  generalRateLimiter,
  async (req, res) => {
    try {
      const { surface, entityType, entityId, reason, details } = req.body;
      const userId = req.user.uid;

      if (!surface || !entityType || !entityId || !reason) {
        return res.status(400).json({
          ok: false,
          error: { 
            code: 'MISSING_PARAMETERS', 
            message: 'surface, entityType, entityId, and reason are required' 
          }
        });
      }

      if (!['feed', 'chat', 'men'].includes(surface)) {
        return res.status(400).json({
          ok: false,
          error: { 
            code: 'INVALID_SURFACE', 
            message: 'surface must be feed, chat, or men' 
          }
        });
      }

      if (!['post', 'comment', 'message', 'user'].includes(entityType)) {
        return res.status(400).json({
          ok: false,
          error: { 
            code: 'INVALID_ENTITY_TYPE', 
            message: 'entityType must be post, comment, message, or user' 
          }
        });
      }

      // Create the report using the existing controller
      const reportData = {
        surface,
        entityType,
        entityId,
        reason,
        details: details || '',
        reporterId: userId
      };

      // Call the existing createReport function
      req.body = reportData;
      return createReport(req, res);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: { code: 'REPORT_CREATION_FAILED', message: 'Failed to create report' }
      });
    }
  }
);

// Get report by ID (requires authentication)
router.get('/:id', authenticateToken, getReportValidation, validate, getReport);

// Update report (requires authentication + moderation)
router.patch(
  '/:id',
  authenticateToken,
  generalRateLimiter,
  updateReportValidation,
  validate,
  updateReport
);

// List reports (requires authentication + moderation)
router.get('/', authenticateToken, listReportsValidation, validate, listReports);

// Get report statistics (requires authentication + moderation)
router.get('/stats', authenticateToken, getReportStats);

// Get reports for specific content (requires authentication + moderation)
router.get('/content/:contentType/:contentId', authenticateToken, getContentReports);

module.exports = router;
