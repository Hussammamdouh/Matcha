const { createModuleLogger } = require('../../lib/logger');
const reportsService = require('./service');

const logger = createModuleLogger();

/**
 * Reports controller for Matcha
 * Handles HTTP requests and responses for report operations
 */

/**
 * Create a new report
 * POST /api/v1/reports
 */
async function createReport(req, res) {
  try {
    const { uid } = req.user;
    const reportData = req.body;

    logger.info('Creating report', {
      userId: uid,
      contentType: reportData.contentType,
      contentId: reportData.contentId,
      reason: reportData.reason,
    });

    const report = await reportsService.createReport(reportData, uid);

    res.status(201).json({
      ok: true,
      data: report,
      meta: {
        message: 'Report submitted successfully',
      },
    });
  } catch (error) {
    logger.error('Failed to create report', {
      error: error.message,
      userId: req.user?.uid,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: error.message,
        },
      });
    }

    if (error.message.includes('already reported')) {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'ALREADY_REPORTED',
          message: 'You have already reported this content',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to submit report',
      },
    });
  }
}

/**
 * Get report by ID
 * GET /api/v1/reports/:id
 */
async function getReport(req, res) {
  try {
    const { id } = req.params;

    logger.info('Getting report', {
      reportId: id,
    });

    const report = await reportsService.getReport(id);

    if (!report) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Report not found',
        },
      });
    }

    res.json({
      ok: true,
      data: report,
    });
  } catch (error) {
    logger.error('Failed to get report', {
      error: error.message,
      reportId: req.params.id,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get report',
      },
    });
  }
}

/**
 * Update report (moderator action)
 * PATCH /api/v1/reports/:id
 */
async function updateReport(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user;
    const updateData = req.body;

    logger.info('Updating report', {
      reportId: id,
      moderatorId: uid,
      updateFields: Object.keys(updateData),
    });

    const report = await reportsService.updateReport(id, updateData, uid);

    res.json({
      ok: true,
      data: report,
      meta: {
        message: 'Report updated successfully',
      },
    });
  } catch (error) {
    logger.error('Failed to update report', {
      error: error.message,
      reportId: req.params.id,
      moderatorId: req.user?.uid,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Report not found',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update report',
      },
    });
  }
}

/**
 * List reports with filtering and pagination
 * GET /api/v1/reports
 */
async function listReports(req, res) {
  try {
    const { status = '', contentType = '', reason = '', pageSize = 20, cursor = null } = req.query;

    logger.info('Listing reports', {
      status,
      contentType,
      reason,
      pageSize: parseInt(pageSize),
      hasCursor: !!cursor,
    });

    const result = await reportsService.listReports({
      status,
      contentType,
      reason,
      pageSize: parseInt(pageSize),
      cursor,
    });

    res.json({
      ok: true,
      data: result.reports,
      meta: {
        pagination: result.pagination,
        filters: { status, contentType, reason },
      },
    });
  } catch (error) {
    logger.error('Failed to list reports', {
      error: error.message,
      query: req.query,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list reports',
      },
    });
  }
}

/**
 * Get user's reports
 * GET /api/v1/users/:userId/reports
 */
async function getUserReports(req, res) {
  try {
    const { userId } = req.params;
    const { uid } = req.user;
    const { pageSize = 20, cursor = null } = req.query;

    // Users can only see their own reports
    if (uid !== userId) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only view your own reports',
        },
      });
    }

    logger.info('Getting user reports', {
      userId,
      pageSize: parseInt(pageSize),
      hasCursor: !!cursor,
    });

    const result = await reportsService.getUserReports(userId, {
      pageSize: parseInt(pageSize),
      cursor,
    });

    res.json({
      ok: true,
      data: result.reports,
      meta: {
        pagination: result.pagination,
      },
    });
  } catch (error) {
    logger.error('Failed to get user reports', {
      error: error.message,
      userId: req.params.userId,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user reports',
      },
    });
  }
}

/**
 * Get report statistics
 * GET /api/v1/reports/stats
 */
async function getReportStats(req, res) {
  try {
    logger.info('Getting report statistics');

    const stats = await reportsService.getReportStats();

    res.json({
      ok: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get report stats', {
      error: error.message,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get report statistics',
      },
    });
  }
}

/**
 * Get reports for specific content
 * GET /api/v1/reports/content/:contentType/:contentId
 */
async function getContentReports(req, res) {
  try {
    const { contentType, contentId } = req.params;

    logger.info('Getting content reports', {
      contentType,
      contentId,
    });

    const reports = await reportsService.getContentReports(contentType, contentId);

    res.json({
      ok: true,
      data: reports,
    });
  } catch (error) {
    logger.error('Failed to get content reports', {
      error: error.message,
      contentType: req.params.contentType,
      contentId: req.params.contentId,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get content reports',
      },
    });
  }
}

module.exports = {
  createReport,
  getReport,
  updateReport,
  listReports,
  getUserReports,
  getReportStats,
  getContentReports,
};
