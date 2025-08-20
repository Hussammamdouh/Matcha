const { getFirestore } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');

// Remove top-level Firebase initialization
// const db = getFirestore();
const logger = createModuleLogger('admin:queues:service');

/**
 * Get Firestore instance (lazy-loaded)
 * @returns {Object} Firestore instance
 */
function getDb() {
  return getFirestore();
}

/**
 * Get unified reports across all surfaces (feed, chat, men)
 * @param {Object} options - Query options
 * @param {string} options.status - Filter by status
 * @param {string} options.surface - Filter by surface (feed, chat, men)
 * @param {string} options.entityType - Filter by entity type
 * @param {string} options.communityId - Filter by community ID
 * @param {string} options.from - Filter by date from (ISO string)
 * @param {string} options.to - Filter by date to (ISO string)
 * @param {string} options.cursor - Pagination cursor
 * @param {number} options.limit - Maximum number of results (max 50)
 * @returns {Promise<Object>} Paginated reports with metadata
 */
async function getUnifiedReports(options = {}) {
  try {
    const db = getDb();
    const {
      status,
      surface,
      entityType,
      communityId,
      from,
      to,
      cursor,
      limit = 20,
    } = options;

    // Validate limit
    const maxLimit = Math.min(limit, 50);
    
    // Build queries for each surface
    const queries = [];
    
    // Feed reports
    if (!surface || surface === 'feed') {
      let feedQuery = db.collection('reports');
      if (status) feedQuery = feedQuery.where('status', '==', status);
      if (entityType) feedQuery = feedQuery.where('entityType', '==', entityType);
      if (communityId) feedQuery = feedQuery.where('communityId', '==', communityId);
      queries.push({ surface: 'feed', query: feedQuery });
    }
    
    // Chat reports
    if (!surface || surface === 'chat') {
      let chatQuery = db.collection('chat_reports');
      if (status) chatQuery = chatQuery.where('status', '==', status);
      if (entityType) chatQuery = chatQuery.where('entityType', '==', entityType);
      queries.push({ surface: 'chat', query: chatQuery });
    }
    
    // Men reports
    if (!surface || surface === 'men') {
      let menQuery = db.collection('men_reports');
      if (status) menQuery = menQuery.where('status', '==', status);
      if (entityType) menQuery = menQuery.where('entityType', '==', entityType);
      queries.push({ surface: 'men', query: menQuery });
    }

    // Execute all queries
    const results = await Promise.all(
      queries.map(async ({ surface, query }) => {
        const snapshot = await query.orderBy('createdAt', 'desc').limit(maxLimit).get();
        return snapshot.docs.map(doc => ({
          id: doc.id,
          surface,
          ...doc.data(),
        }));
      })
    );

    // Flatten and merge results
    let allReports = results.flat();
    
    // Apply date filters in memory to avoid composite indexes
    if (from) {
      const fromDate = new Date(from);
      allReports = allReports.filter(report => 
        report.createdAt && new Date(report.createdAt.toDate ? report.createdAt.toDate() : report.createdAt) >= fromDate
      );
    }
    
    if (to) {
      const toDate = new Date(to);
      allReports = allReports.filter(report => 
        report.createdAt && new Date(report.createdAt.toDate ? report.createdAt.toDate() : report.createdAt) <= toDate
      );
    }
    
    // Sort by createdAt desc
    allReports.sort((a, b) => {
      const aDate = a.createdAt && new Date(a.createdAt.toDate ? a.createdAt.toDate() : a.createdAt);
      const bDate = b.createdAt && new Date(b.createdAt.toDate ? b.createdAt.toDate() : b.createdAt);
      return bDate - aDate;
    });
    
    // Apply cursor-based pagination
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = allReports.findIndex(report => report.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }
    
    const paginatedReports = allReports.slice(startIndex, startIndex + maxLimit);
    const hasMore = startIndex + maxLimit < allReports.length;
    const nextCursor = hasMore ? paginatedReports[paginatedReports.length - 1]?.id : null;
    
    logger.info('Unified reports retrieved', {
      total: allReports.length,
      returned: paginatedReports.length,
      hasMore,
      filters: { status, surface, entityType, communityId, from, to },
    });

    return {
      reports: paginatedReports,
      meta: {
        total: allReports.length,
        returned: paginatedReports.length,
        hasMore,
        nextCursor,
        filters: { status, surface, entityType, communityId, from, to },
      },
    };
  } catch (error) {
    logger.error('Failed to get unified reports', {
      error: error.message,
      options,
    });
    throw error;
  }
}

/**
 * Claim a report for review
 * @param {string} reportId - Report ID
 * @param {string} surface - Report surface (feed, chat, men)
 * @param {string} actorUserId - ID of the user claiming the report
 * @returns {Promise<Object>} Updated report
 */
async function claimReport(reportId, surface, actorUserId) {
  try {
    const db = getDb();
    const collectionName = getCollectionName(surface);
    
    if (!collectionName) {
      throw new Error(`Invalid surface: ${surface}`);
    }

    const reportRef = db.collection(collectionName).doc(reportId);
    
    const result = await db.runTransaction(async (transaction) => {
      const reportDoc = await transaction.get(reportRef);
      
      if (!reportDoc.exists) {
        throw new Error('Report not found');
      }
      
      const reportData = reportDoc.data();
      
      if (reportData.status !== 'new') {
        throw new Error(`Report cannot be claimed. Current status: ${reportData.status}`);
      }
      
      const updates = {
        status: 'in_review',
        claimedBy: actorUserId,
        claimedAt: new Date(),
        updatedAt: new Date(),
      };
      
      transaction.update(reportRef, updates);
      
      return {
        id: reportId,
        ...reportData,
        ...updates,
      };
    });
    
    logger.info('Report claimed', {
      reportId,
      surface,
      actorUserId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to claim report', {
      error: error.message,
      reportId,
      surface,
      actorUserId,
    });
    throw error;
  }
}

/**
 * Resolve a report
 * @param {string} reportId - Report ID
 * @param {string} surface - Report surface (feed, chat, men)
 * @param {string} actorUserId - ID of the user resolving the report
 * @param {string} resolutionCode - Resolution code
 * @param {string} note - Optional resolution note
 * @returns {Promise<Object>} Updated report
 */
async function resolveReport(reportId, surface, actorUserId, resolutionCode, note) {
  try {
    const db = getDb();
    const collectionName = getCollectionName(surface);
    
    if (!collectionName) {
      throw new Error(`Invalid surface: ${surface}`);
    }

    const reportRef = db.collection(collectionName).doc(reportId);
    
    const result = await db.runTransaction(async (transaction) => {
      const reportDoc = await transaction.get(reportRef);
      
      if (!reportDoc.exists) {
        throw new Error('Report not found');
      }
      
      const reportData = reportDoc.data();
      
      if (reportData.status === 'resolved' || reportData.status === 'dismissed') {
        throw new Error(`Report already ${reportData.status}`);
      }
      
      const updates = {
        status: 'resolved',
        resolvedBy: actorUserId,
        resolvedAt: new Date(),
        resolutionCode,
        resolutionNote: note || null,
        updatedAt: new Date(),
      };
      
      transaction.update(reportRef, updates);
      
      return {
        id: reportId,
        ...reportData,
        ...updates,
      };
    });
    
    logger.info('Report resolved', {
      reportId,
      surface,
      actorUserId,
      resolutionCode,
    });

    return result;
  } catch (error) {
    logger.error('Failed to resolve report', {
      error: error.message,
      reportId,
      surface,
      actorUserId,
      resolutionCode,
    });
    throw error;
  }
}

/**
 * Dismiss a report
 * @param {string} reportId - Report ID
 * @param {string} surface - Report surface (feed, chat, men)
 * @param {string} actorUserId - ID of the user dismissing the report
 * @param {string} note - Optional dismissal note
 * @returns {Promise<Object>} Updated report
 */
async function dismissReport(reportId, surface, actorUserId, note) {
  try {
    const db = getDb();
    const collectionName = getCollectionName(surface);
    
    if (!collectionName) {
      throw new Error(`Invalid surface: ${surface}`);
    }

    const reportRef = db.collection(collectionName).doc(reportId);
    
    const result = await db.runTransaction(async (transaction) => {
      const reportDoc = await transaction.get(reportRef);
      
      if (!reportDoc.exists) {
        throw new Error('Report not found');
      }
      
      const reportData = reportDoc.data();
      
      if (reportData.status === 'resolved' || reportData.status === 'dismissed') {
        throw new Error(`Report already ${reportData.status}`);
      }
      
      const updates = {
        status: 'dismissed',
        dismissedBy: actorUserId,
        dismissedAt: new Date(),
        dismissalNote: note || null,
        updatedAt: new Date(),
      };
      
      transaction.update(reportRef, updates);
      
      return {
        id: reportId,
        ...reportData,
        ...updates,
      };
    });
    
    logger.info('Report dismissed', {
      reportId,
      surface,
      actorUserId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to dismiss report', {
      error: error.message,
      reportId,
      surface,
      actorUserId,
    });
    throw error;
  }
}

/**
 * Bulk resolve reports
 * @param {Array<string>} reportIds - Array of report IDs
 * @param {string} surface - Report surface (feed, chat, men)
 * @param {string} actorUserId - ID of the user resolving the reports
 * @param {string} resolutionCode - Resolution code
 * @param {string} note - Optional resolution note
 * @returns {Promise<Object>} Bulk operation result
 */
async function bulkResolveReports(reportIds, surface, actorUserId, resolutionCode, note) {
  try {
    const db = getDb();
    const collectionName = getCollectionName(surface);
    
    if (!collectionName) {
      throw new Error(`Invalid surface: ${surface}`);
    }

    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      throw new Error('Report IDs array is required and cannot be empty');
    }

    if (reportIds.length > 50) {
      throw new Error('Cannot process more than 50 reports at once');
    }

    const batch = db.batch();
    const results = [];
    const errors = [];

    // Get all reports first to validate
    const reportRefs = reportIds.map(id => db.collection(collectionName).doc(id));
    const reportDocs = await Promise.all(reportRefs.map(ref => ref.get()));

    reportDocs.forEach((doc, index) => {
      const reportId = reportIds[index];
      
      if (!doc.exists) {
        errors.push({ reportId, error: 'Report not found' });
        return;
      }

      const reportData = doc.data();
      
      if (reportData.status === 'resolved' || reportData.status === 'dismissed') {
        errors.push({ 
          reportId, 
          error: `Report already ${reportData.status}` 
        });
        return;
      }

      const updates = {
        status: 'resolved',
        resolvedBy: actorUserId,
        resolvedAt: new Date(),
        resolutionCode,
        resolutionNote: note || null,
        updatedAt: new Date(),
      };

      batch.update(doc.ref, updates);
      results.push({
        id: reportId,
        ...reportData,
        ...updates,
      });
    });

    if (results.length > 0) {
      await batch.commit();
    }
    
    logger.info('Bulk reports resolved', {
      total: reportIds.length,
      successful: results.length,
      failed: errors.length,
      surface,
      actorUserId,
      resolutionCode,
    });

    return {
      successful: results,
      failed: errors,
      meta: {
        total: reportIds.length,
        successful: results.length,
        failed: errors.length,
      },
    };
  } catch (error) {
    logger.error('Failed to bulk resolve reports', {
      error: error.message,
      reportIds,
      surface,
      actorUserId,
      resolutionCode,
    });
    throw error;
  }
}

/**
 * Bulk dismiss reports
 * @param {Array<string>} reportIds - Array of report IDs
 * @param {string} surface - Report surface (feed, chat, men)
 * @param {string} actorUserId - ID of the user dismissing the reports
 * @param {string} note - Optional dismissal note
 * @returns {Promise<Object>} Bulk operation result
 */
async function bulkDismissReports(reportIds, surface, actorUserId, note) {
  try {
    const db = getDb();
    const collectionName = getCollectionName(surface);
    
    if (!collectionName) {
      throw new Error(`Invalid surface: ${surface}`);
    }

    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      throw new Error('Report IDs array is required and cannot be empty');
    }

    if (reportIds.length > 50) {
      throw new Error('Cannot process more than 50 reports at once');
    }

    const batch = db.batch();
    const results = [];
    const errors = [];

    // Get all reports first to validate
    const reportRefs = reportIds.map(id => db.collection(collectionName).doc(id));
    const reportDocs = await Promise.all(reportRefs.map(ref => ref.get()));

    reportDocs.forEach((doc, index) => {
      const reportId = reportIds[index];
      
      if (!doc.exists) {
        errors.push({ reportId, error: 'Report not found' });
        return;
      }

      const reportData = doc.data();
      
      if (reportData.status === 'resolved' || reportData.status === 'dismissed') {
        errors.push({ 
          reportId, 
          error: `Report already ${reportData.status}` 
        });
        return;
      }

      const updates = {
        status: 'dismissed',
        dismissedBy: actorUserId,
        dismissedAt: new Date(),
        dismissalNote: note || null,
        updatedAt: new Date(),
      };

      batch.update(doc.ref, updates);
      results.push({
        id: reportId,
        ...reportData,
        ...updates,
      });
    });

    if (results.length > 0) {
      await batch.commit();
    }
    
    logger.info('Bulk reports dismissed', {
      total: reportIds.length,
      successful: results.length,
      failed: errors.length,
      surface,
      actorUserId,
    });

    return {
      successful: results,
      failed: errors,
      meta: {
        total: reportIds.length,
        successful: results.length,
        failed: errors.length,
      },
    };
  } catch (error) {
    logger.error('Failed to bulk dismiss reports', {
      error: error.message,
      reportIds,
      surface,
      actorUserId,
    });
    throw error;
  }
}

/**
 * Get collection name for a surface
 * @param {string} surface - Surface name
 * @returns {string|null} Collection name
 */
function getCollectionName(surface) {
  const collections = {
    feed: 'reports',
    chat: 'chat_reports',
    men: 'men_reports',
  };
  
  return collections[surface] || null;
}

module.exports = {
  getUnifiedReports,
  claimReport,
  resolveReport,
  dismissReport,
  bulkResolveReports,
  bulkDismissReports,
};
