const { getFirestore } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../../lib/logger');

const logger = createModuleLogger('chat:reports:service');
let db;

/**
 * Create a chat report
 * @param {Object} data - Report data
 * @param {string} data.type - Type of report: 'message', 'conversation', 'user'
 * @param {string} data.targetId - ID of the reported item
 * @param {string} data.conversationId - ID of the conversation (optional for user reports)
 * @param {string} data.reporterId - ID of the user making the report
 * @param {string} data.reasonCode - Reason code for the report
 * @param {string} data.note - Additional notes (optional)
 * @returns {Promise<Object>} The created report
 */
async function createReport(data) {
  db = db || getFirestore();
  try {
    const {
      type,
      targetId,
      conversationId,
      reporterId,
      reasonCode,
      note,
    } = data;

    // Validate report type
    if (!['message', 'conversation', 'user'].includes(type)) {
      throw new Error('Invalid report type');
    }

    // Validate reason code
    const validReasonCodes = [
      'spam',
      'harassment',
      'inappropriate_content',
      'violence',
      'fake_news',
      'copyright',
      'other',
    ];

    if (!validReasonCodes.includes(reasonCode)) {
      throw new Error('Invalid reason code');
    }

    const reportData = {
      type,
      targetId,
      conversationId: conversationId || null,
      reporterId,
      reasonCode,
      note: note || null,
      status: 'new',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const reportRef = await db.collection('chat_reports').add(reportData);

    logger.info('Chat report created', {
      reportId: reportRef.id,
      type,
      targetId,
      reporterId,
    });

    return {
      id: reportRef.id,
      ...reportData,
    };
  } catch (error) {
    logger.error('Failed to create chat report', { error: error.message, data });
    throw error;
  }
}

/**
 * Get chat reports with filtering and pagination
 * @param {Object} options - Query options
 * @param {string} options.status - Filter by status
 * @param {string} options.type - Filter by type
 * @param {string} options.reporterId - Filter by reporter
 * @param {string} options.conversationId - Filter by conversation
 * @param {string} options.cursor - Pagination cursor
 * @param {number} options.pageSize - Number of results per page
 * @returns {Promise<Object>} Paginated list of reports
 */
async function getReports(options = {}) {
  db = db || getFirestore();
  try {
    const {
      status,
      type,
      reporterId,
      conversationId,
      cursor,
      pageSize = 20,
    } = options;

    let query = db.collection('chat_reports')
      .orderBy('createdAt', 'desc')
      .limit(pageSize + 1); // +1 to check if there are more results

    // Apply filters
    if (status) {
      query = query.where('status', '==', status);
    }

    if (type) {
      query = query.where('type', '==', type);
    }

    if (reporterId) {
      query = query.where('reporterId', '==', reporterId);
    }

    if (conversationId) {
      query = query.where('conversationId', '==', conversationId);
    }

    if (cursor) {
      query = query.startAfter(cursor);
    }

    const snapshot = await query.get();
    const reports = [];

    snapshot.forEach(doc => {
      reports.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    const hasMore = reports.length > pageSize;
    const nextCursor = hasMore ? reports[pageSize - 1] : null;

    if (hasMore) {
      reports.pop(); // Remove the extra item
    }

    // Get user details for reporters
    const reporterIds = [...new Set(reports.map(report => report.reporterId))];
    const usersSnapshot = await db.collection('users')
      .where('__name__', 'in', reporterIds)
      .get();

    const users = {};
    usersSnapshot.forEach(doc => {
      users[doc.id] = {
        id: doc.id,
        nickname: doc.data().nickname || 'Unknown User',
        avatarUrl: doc.data().avatarUrl || null,
      };
    });

    // Enhance reports with user details
    const enhancedReports = reports.map(report => ({
      ...report,
      reporter: users[report.reporterId] || {
        id: report.reporterId,
        nickname: 'Unknown User',
        avatarUrl: null,
      },
    }));

    return {
      reports: enhancedReports,
      meta: {
        hasMore,
        nextCursor,
        total: enhancedReports.length,
      },
    };
  } catch (error) {
    logger.error('Failed to get chat reports', { error: error.message, options });
    throw error;
  }
}

/**
 * Update report status (admin/moderator only)
 * @param {string} reportId - ID of the report to update
 * @param {string} status - New status: 'in_review', 'resolved', 'dismissed'
 * @param {string} reviewerId - ID of the user reviewing the report
 * @param {string} resolutionNote - Optional note about the resolution
 * @returns {Promise<Object>} The updated report
 */
async function updateReportStatus(reportId, status, reviewerId, resolutionNote = null) {
  db = db || getFirestore();
  try {
    // Validate status
    if (!['in_review', 'resolved', 'dismissed'].includes(status)) {
      throw new Error('Invalid status');
    }

    const reportRef = db.collection('chat_reports').doc(reportId);
    const reportDoc = await reportRef.get();

    if (!reportDoc.exists) {
      throw new Error('Report not found');
    }

    const updateData = {
      status,
      reviewerId,
      updatedAt: new Date(),
    };

    if (resolutionNote) {
      updateData.resolutionNote = resolutionNote;
    }

    await reportRef.update(updateData);

    logger.info('Chat report status updated', {
      reportId,
      status,
      reviewerId,
    });

    return {
      id: reportId,
      ...reportDoc.data(),
      ...updateData,
    };
  } catch (error) {
    logger.error('Failed to update report status', {
      error: error.message,
      reportId,
      status,
      reviewerId,
    });
    throw error;
  }
}

/**
 * Get report by ID
 * @param {string} reportId - ID of the report
 * @returns {Promise<Object|null>} The report or null if not found
 */
async function getReport(reportId) {
  db = db || getFirestore();
  try {
    const reportDoc = await db.collection('chat_reports').doc(reportId).get();

    if (!reportDoc.exists) {
      return null;
    }

    return {
      id: reportDoc.id,
      ...reportDoc.data(),
    };
  } catch (error) {
    logger.error('Failed to get report', { error: error.message, reportId });
    throw error;
  }
}

module.exports = {
  createReport,
  getReports,
  updateReportStatus,
  getReport,
};
