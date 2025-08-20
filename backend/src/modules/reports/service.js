const { getFirestore } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');
const { generateCursor, parseCursor } = require('../../lib/ranking');

const db = getFirestore();
const logger = createModuleLogger();

/**
 * Reports service for Matcha
 * Handles all Firestore operations for content moderation
 */

/**
 * Create a new report
 *
 * @param {Object} reportData - Report data
 * @param {string} userId - User ID creating the report
 * @returns {Object} Created report
 */
async function createReport(reportData, userId) {
  try {
    // Check if content exists
    const contentExists = await checkContentExists(reportData.contentType, reportData.contentId);
    if (!contentExists) {
      throw new Error(`${reportData.contentType} not found`);
    }

    // Check if user has already reported this content
    const existingReport = await db
      .collection('reports')
      .where('contentType', '==', reportData.contentType)
      .where('contentId', '==', reportData.contentId)
      .where('reporterId', '==', userId)
      .where('status', 'in', ['pending', 'investigating'])
      .limit(1)
      .get();

    if (!existingReport.empty) {
      throw new Error('You have already reported this content');
    }

    // Create report document
    const reportRef = db.collection('reports').doc();
    const report = {
      id: reportRef.id,
      contentType: reportData.contentType,
      contentId: reportData.contentId,
      reporterId: userId,
      reason: reportData.reason,
      description: reportData.description || '',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      moderatorId: null,
      moderatorNotes: '',
      action: null,
      actionDate: null,
    };

    await reportRef.set(report);

    logger.info('Report created successfully', {
      reportId: reportRef.id,
      contentType: reportData.contentType,
      contentId: reportData.contentId,
      reporterId: userId,
      reason: reportData.reason,
    });

    return report;
  } catch (error) {
    logger.error('Failed to create report', {
      error: error.message,
      reportData,
      userId,
    });
    throw error;
  }
}

/**
 * Get report by ID
 *
 * @param {string} reportId - Report ID
 * @returns {Object|null} Report data or null if not found
 */
async function getReport(reportId) {
  try {
    const reportDoc = await db.collection('reports').doc(reportId).get();

    if (!reportDoc.exists) {
      return null;
    }

    const report = { id: reportDoc.id, ...reportDoc.data() };

    // Get reporter details
    const reporterDoc = await db.collection('users').doc(report.reporterId).get();
    if (reporterDoc.exists) {
      report.reporter = {
        id: reporterDoc.id,
        nickname: reporterDoc.data().nickname,
        avatarUrl: reporterDoc.data().avatarUrl,
      };
    }

    // Get moderator details if assigned
    if (report.moderatorId) {
      const moderatorDoc = await db.collection('users').doc(report.moderatorId).get();
      if (moderatorDoc.exists) {
        report.moderator = {
          id: moderatorDoc.id,
          nickname: moderatorDoc.data().nickname,
          avatarUrl: moderatorDoc.data().avatarUrl,
        };
      }
    }

    return report;
  } catch (error) {
    logger.error('Failed to get report', {
      error: error.message,
      reportId,
    });
    throw error;
  }
}

/**
 * Update report (moderator action)
 *
 * @param {string} reportId - Report ID
 * @param {Object} updateData - Data to update
 * @param {string} moderatorId - Moderator ID performing the update
 * @returns {Object} Updated report
 */
async function updateReport(reportId, updateData, moderatorId) {
  try {
    const reportRef = db.collection('reports').doc(reportId);

    // Check if report exists
    const reportDoc = await reportRef.get();
    if (!reportDoc.exists) {
      throw new Error('Report not found');
    }

    const report = reportDoc.data();

    // Update report
    const updatePayload = {
      ...updateData,
      moderatorId,
      updatedAt: new Date(),
    };

    // Set action date if action is provided
    if (updateData.action && updateData.action !== 'none') {
      updatePayload.actionDate = new Date();
    }

    await reportRef.update(updatePayload);

    logger.info('Report updated successfully', {
      reportId,
      updatedBy: moderatorId,
      updatedFields: Object.keys(updateData),
    });

    return { id: reportId, ...report, ...updatePayload };
  } catch (error) {
    logger.error('Failed to update report', {
      error: error.message,
      reportId,
      updateData,
      moderatorId,
    });
    throw error;
  }
}

/**
 * List reports with filtering and pagination
 *
 * @param {Object} options - Query options
 * @returns {Object} Paginated reports list
 */
async function listReports(options = {}) {
  try {
    const { status = '', contentType = '', reason = '', pageSize = 20, cursor = null } = options;

    let query = db.collection('reports');

    // Apply filters
    if (status) {
      query = query.where('status', '==', status);
    }

    if (contentType) {
      query = query.where('contentType', '==', contentType);
    }

    if (reason) {
      query = query.where('reason', '==', reason);
    }

    // Apply sorting (most recent first)
    query = query.orderBy('createdAt', 'desc');

    // Apply pagination
    if (cursor) {
      const parsedCursor = parseCursor(cursor);
      if (parsedCursor) {
        // TODO: Implement cursor-based pagination
      }
    }

    query = query.limit(pageSize);

    const snapshot = await query.get();
    const reports = [];

    // Get report details with user info
    for (const reportDoc of snapshot.docs) {
      const report = { id: reportDoc.id, ...reportDoc.data() };

      // Get reporter details
      const reporterDoc = await db.collection('users').doc(report.reporterId).get();
      if (reporterDoc.exists) {
        report.reporter = {
          id: reporterDoc.id,
          nickname: reporterDoc.data().nickname,
          avatarUrl: reporterDoc.data().avatarUrl,
        };
      }

      reports.push(report);
    }

    // Generate next cursor
    let nextCursor = null;
    if (reports.length === pageSize) {
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      nextCursor = generateCursor(lastDoc.data(), 'reports');
    }

    return {
      reports,
      pagination: {
        pageSize,
        hasMore: reports.length === pageSize,
        nextCursor,
      },
    };
  } catch (error) {
    logger.error('Failed to list reports', {
      error: error.message,
      options,
    });
    throw error;
  }
}

/**
 * Get reports for a specific user
 *
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} Paginated reports list
 */
async function getUserReports(userId, options = {}) {
  try {
    const { pageSize = 20, cursor = null } = options;

    let query = db
      .collection('reports')
      .where('reporterId', '==', userId)
      .orderBy('createdAt', 'desc');

    // Apply pagination
    if (cursor) {
      const parsedCursor = parseCursor(cursor);
      if (parsedCursor) {
        // TODO: Implement cursor-based pagination
      }
    }

    query = query.limit(pageSize);

    const snapshot = await query.get();
    const reports = [];

    snapshot.forEach(doc => {
      reports.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Generate next cursor
    let nextCursor = null;
    if (reports.length === pageSize) {
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      nextCursor = generateCursor(lastDoc.data(), 'user_reports');
    }

    return {
      reports,
      pagination: {
        pageSize,
        hasMore: reports.length === pageSize,
        nextCursor,
      },
    };
  } catch (error) {
    logger.error('Failed to get user reports', {
      error: error.message,
      userId,
      options,
    });
    throw error;
  }
}

/**
 * Get report statistics
 *
 * @returns {Object} Report statistics
 */
async function getReportStats() {
  try {
    const stats = {
      total: 0,
      pending: 0,
      investigating: 0,
      resolved: 0,
      dismissed: 0,
      byContentType: {},
      byReason: {},
    };

    // Get total counts by status
    const statuses = ['pending', 'investigating', 'resolved', 'dismissed'];
    for (const status of statuses) {
      const statusQuery = await db.collection('reports').where('status', '==', status).get();
      stats[status] = statusQuery.size;
      stats.total += statusQuery.size;
    }

    // Get counts by content type
    const contentTypes = ['post', 'comment', 'user', 'community'];
    for (const contentType of contentTypes) {
      const typeQuery = await db
        .collection('reports')
        .where('contentType', '==', contentType)
        .get();
      stats.byContentType[contentType] = typeQuery.size;
    }

    // Get counts by reason
    const reasons = [
      'spam',
      'harassment',
      'hate_speech',
      'violence',
      'misinformation',
      'copyright',
      'other',
    ];
    for (const reason of reasons) {
      const reasonQuery = await db.collection('reports').where('reason', '==', reason).get();
      stats.byReason[reason] = reasonQuery.size;
    }

    return stats;
  } catch (error) {
    logger.error('Failed to get report stats', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Check if reported content exists
 *
 * @param {string} contentType - Type of content
 * @param {string} contentId - Content ID
 * @returns {boolean} True if content exists
 */
async function checkContentExists(contentType, contentId) {
  try {
    let collectionName;

    switch (contentType) {
      case 'post':
        collectionName = 'posts';
        break;
      case 'comment':
        collectionName = 'comments';
        break;
      case 'user':
        collectionName = 'users';
        break;
      case 'community':
        collectionName = 'communities';
        break;
      default:
        return false;
    }

    const doc = await db.collection(collectionName).doc(contentId).get();
    return doc.exists;
  } catch (error) {
    logger.error('Failed to check content existence', {
      error: error.message,
      contentType,
      contentId,
    });
    return false;
  }
}

/**
 * Get reports for specific content
 *
 * @param {string} contentType - Type of content
 * @param {string} contentId - Content ID
 * @returns {Array} Array of reports
 */
async function getContentReports(contentType, contentId) {
  try {
    const reportsQuery = await db
      .collection('reports')
      .where('contentType', '==', contentType)
      .where('contentId', '==', contentId)
      .orderBy('createdAt', 'desc')
      .get();

    const reports = [];
    reportsQuery.forEach(doc => {
      reports.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return reports;
  } catch (error) {
    logger.error('Failed to get content reports', {
      error: error.message,
      contentType,
      contentId,
    });
    return [];
  }
}

module.exports = {
  createReport,
  getReport,
  updateReport,
  listReports,
  getUserReports,
  getReportStats,
  checkContentExists,
  getContentReports,
};
