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
