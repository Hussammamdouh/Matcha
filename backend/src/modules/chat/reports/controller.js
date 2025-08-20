const { createModuleLogger } = require('../../../lib/logger');
const reportsService = require('./service');

const logger = createModuleLogger('chat:reports:controller');

/**
 * Create a chat report
 * POST /api/v1/chat/reports
 */
async function createReport(req, res) {
  try {
    const {
      type,
      targetId,
      conversationId,
      reasonCode,
      note,
    } = req.body;
    const reporterId = req.user.uid;

    if (!type || !targetId || !reasonCode) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'MISSING_FIELD',
          message: 'type, targetId, and reasonCode are required',
        },
      });
    }

    const reportData = {
      type,
      targetId,
      conversationId,
      reporterId,
      reasonCode,
      note,
    };

    const report = await reportsService.createReport(reportData);

    res.status(201).json({
      ok: true,
      data: report,
    });
  } catch (error) {
    logger.error('Failed to create chat report', { error: error.message, userId: req.user.uid });

    if (error.message === 'Invalid report type' || error.message === 'Invalid reason code') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create report',
      },
    });
  }
}

/**
 * Get chat reports (admin/moderator only)
 * GET /api/v1/chat/reports
 */
async function getReports(req, res) {
  try {
    const {
      status,
      type,
      reporterId,
      conversationId,
      cursor,
      pageSize,
    } = req.query;

    const options = {
      status: status || null,
      type: type || null,
      reporterId: reporterId || null,
      conversationId: conversationId || null,
      cursor: cursor || null,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    };

    const result = await reportsService.getReports(options);

    res.json({
      ok: true,
      data: result.reports,
      meta: result.meta,
    });
  } catch (error) {
    logger.error('Failed to get chat reports', { error: error.message, userId: req.user.uid });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get reports',
      },
    });
  }
}

/**
 * Get a specific chat report (admin/moderator only)
 * GET /api/v1/chat/reports/:id
 */
async function getReport(req, res) {
  try {
    const { id } = req.params;
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
    logger.error('Failed to get chat report', { error: error.message, reportId: req.params.id });

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
 * Update report status (admin/moderator only)
 * PATCH /api/v1/chat/reports/:id/status
 */
async function updateReportStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;
    const reviewerId = req.user.uid;

    if (!status) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'MISSING_FIELD',
          message: 'status is required',
        },
      });
    }

    const report = await reportsService.updateReportStatus(id, status, reviewerId, resolutionNote);

    res.json({
      ok: true,
      data: report,
    });
  } catch (error) {
    logger.error('Failed to update report status', { error: error.message, reportId: req.params.id });

    if (error.message === 'Invalid status') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: error.message,
        },
      });
    }

    if (error.message === 'Report not found') {
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
        message: 'Failed to update report status',
      },
    });
  }
}

module.exports = {
  createReport,
  getReports,
  getReport,
  updateReportStatus,
};
