const { getFirestore } = require('../../lib/firebase');
const { createRequestLogger } = require('../../lib/logger');

/**
 * Create audit log entry
 * @param {Object} auditData - Audit log data
 * @returns {Promise<void>}
 */
async function createAuditLog(auditData) {
  try {
    const firestore = getFirestore();
    
    const auditEntry = {
      ...auditData,
      createdAt: new Date(),
    };

    await firestore.collection('audit_logs').add(auditEntry);
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    const logger = createRequestLogger();
    logger.error('Failed to create audit log', {
      error: error.message,
      auditData,
    });
  }
}

module.exports = {
  createAuditLog,
};
