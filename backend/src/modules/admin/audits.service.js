const { getFirestore } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');
const crypto = require('crypto');

// Remove top-level Firebase initialization
// const db = getFirestore();
const logger = createModuleLogger('admin:audits:service');

/**
 * Get Firestore instance (lazy-loaded)
 * @returns {Object} Firestore instance
 */
function getDb() {
  return getFirestore();
}

/**
 * Create an audit log entry for admin actions
 * @param {Object} data - Audit log data
 * @param {string} data.actorUserId - ID of the user performing the action
 * @param {string} data.action - Action performed (e.g., 'user.ban', 'post.remove')
 * @param {string} data.entity - Entity type (e.g., 'user', 'post', 'comment')
 * @param {string} data.entityId - ID of the affected entity
 * @param {string} data.reason - Reason for the action
 * @param {Object} data.metadata - Additional metadata
 * @param {string} data.ip - IP address of the actor
 * @param {string} data.userAgent - User agent of the actor
 * @param {string} data.idempotencyKey - Idempotency key if provided
 * @returns {Promise<Object>} Created audit log
 */
async function createAuditLog(data) {
  try {
    const db = getDb();
    const {
      actorUserId,
      action,
      entity,
      entityId,
      reason,
      metadata = {},
      ip,
      userAgent,
      idempotencyKey,
    } = data;

    // Generate idempotency hash if key provided
    let idempotencyHash = null;
    if (idempotencyKey) {
      const hashInput = `${actorUserId}:${action}:${entity}:${entityId}:${idempotencyKey}`;
      idempotencyHash = crypto.createHash('sha256').update(hashInput).digest('hex');
    }

    const auditLog = {
      actorUserId,
      action,
      entity,
      entityId,
      reason: reason || null,
      metadata,
      ip: ip || null,
      userAgent: userAgent || null,
      idempotencyKey: idempotencyKey || null,
      idempotencyHash,
      createdAt: new Date(),
      timestamp: Date.now(),
    };

    const docRef = await db.collection('audit_logs').add(auditLog);
    
    logger.info('Audit log created', {
      auditId: docRef.id,
      actorUserId,
      action,
      entity,
      entityId,
      hasIdempotencyKey: !!idempotencyKey,
    });

    return {
      id: docRef.id,
      ...auditLog,
    };
  } catch (error) {
    logger.error('Failed to create audit log', {
      error: error.message,
      data,
    });
    throw error;
  }
}

/**
 * Check if an action with the same idempotency key has already been performed
 * @param {string} actorUserId - ID of the user
 * @param {string} action - Action to perform
 * @param {string} entity - Entity type
 * @param {string} entityId - Entity ID
 * @param {string} idempotencyKey - Idempotency key
 * @returns {Promise<Object|null>} Existing audit log if found, null otherwise
 */
async function checkIdempotency(actorUserId, action, entity, entityId, idempotencyKey) {
  if (!idempotencyKey) return null;

  try {
    const db = getDb();
    const hashInput = `${actorUserId}:${action}:${entity}:${entityId}:${idempotencyKey}`;
    const idempotencyHash = crypto.createHash('sha256').update(hashInput).digest('hex');

    const query = await db
      .collection('audit_logs')
      .where('idempotencyHash', '==', idempotencyHash)
      .limit(1)
      .get();

    if (!query.empty) {
      const existingLog = query.docs[0].data();
      logger.info('Idempotency check: action already performed', {
        existingAuditId: query.docs[0].id,
        action,
        entity,
        entityId,
        idempotencyKey,
      });
      return {
        id: query.docs[0].id,
        ...existingLog,
      };
    }

    return null;
  } catch (error) {
    logger.error('Failed to check idempotency', {
      error: error.message,
      actorUserId,
      action,
      entity,
      entityId,
      idempotencyKey,
    });
    throw error;
  }
}

/**
 * Get audit logs with filtering and pagination
 * @param {Object} options - Query options
 * @param {string} options.actorId - Filter by actor user ID
 * @param {string} options.action - Filter by action
 * @param {string} options.entityType - Filter by entity type
 * @param {Date} options.from - Filter by start date
 * @param {Date} options.to - Filter by end date
 * @param {string} options.cursor - Pagination cursor
 * @param {number} options.limit - Maximum number of results (max 50)
 * @returns {Promise<Object>} Paginated audit logs
 */
async function getAuditLogs(options = {}) {
  try {
    const db = getDb();
    const {
      actorId,
      action,
      entityType,
      from,
      to,
      cursor,
      limit = 20,
    } = options;

    // Enforce limit
    const queryLimit = Math.min(limit, 50);

    let query = db.collection('audit_logs');

    // Apply filters
    if (actorId) {
      query = query.where('actorUserId', '==', actorId);
    }

    if (action) {
      query = query.where('action', '==', action);
    }

    if (entityType) {
      query = query.where('entity', '==', entityType);
    }

    if (from) {
      query = query.where('timestamp', '>=', from.getTime());
    }

    if (to) {
      query = query.where('timestamp', '<=', to.getTime());
    }

    // Order by timestamp descending (most recent first)
    query = query.orderBy('timestamp', 'desc');

    // Apply cursor if provided
    if (cursor) {
      const cursorDoc = await db.collection('audit_logs').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    // Execute query
    const snapshot = await query.limit(queryLimit + 1).get();
    const docs = snapshot.docs;

    // Check if there are more results
    const hasMore = docs.length > queryLimit;
    const results = docs.slice(0, queryLimit);

    // Build response
    const auditLogs = results.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Generate next cursor
    let nextCursor = null;
    if (hasMore && results.length > 0) {
      nextCursor = results[results.length - 1].id;
    }

    logger.debug('Audit logs retrieved', {
      count: auditLogs.length,
      hasMore,
      filters: { actorId, action, entityType, from, to },
    });

    return {
      data: auditLogs,
      meta: {
        count: auditLogs.length,
        hasMore,
        nextCursor,
        limit: queryLimit,
      },
    };
  } catch (error) {
    logger.error('Failed to retrieve audit logs', {
      error: error.message,
      options,
    });
    throw error;
  }
}

/**
 * Get audit log by ID
 * @param {string} auditId - Audit log ID
 * @returns {Promise<Object|null>} Audit log or null if not found
 */
async function getAuditLog(auditId) {
  try {
    const db = getDb();
    const doc = await db.collection('audit_logs').doc(auditId).get();
    
    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    };
  } catch (error) {
    logger.error('Failed to retrieve audit log', {
      error: error.message,
      auditId,
    });
    throw error;
  }
}

/**
 * Get audit logs for a specific entity
 * @param {string} entity - Entity type
 * @param {string} entityId - Entity ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Paginated audit logs for entity
 */
async function getEntityAuditLogs(entity, entityId, options = {}) {
  try {
    const db = getDb();
    let query = db
      .collection('audit_logs')
      .where('entity', '==', entity)
      .where('entityId', '==', entityId)
      .orderBy('timestamp', 'desc');

    const { cursor, limit = 20 } = options;
    const queryLimit = Math.min(limit, 50);

    if (cursor) {
      const cursorDoc = await db.collection('audit_logs').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.limit(queryLimit + 1).get();
    const docs = snapshot.docs;

    const hasMore = docs.length > queryLimit;
    const results = docs.slice(0, queryLimit);

    const auditLogs = results.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    let nextCursor = null;
    if (hasMore && results.length > 0) {
      nextCursor = results[results.length - 1].id;
    }

    return {
      data: auditLogs,
      meta: {
        count: auditLogs.length,
        hasMore,
        nextCursor,
        limit: queryLimit,
      },
    };
  } catch (error) {
    logger.error('Failed to retrieve entity audit logs', {
      error: error.message,
      entity,
      entityId,
      options,
    });
    throw error;
  }
}

module.exports = {
  createAuditLog,
  checkIdempotency,
  getAuditLogs,
  getAuditLog,
  getEntityAuditLogs,
};
