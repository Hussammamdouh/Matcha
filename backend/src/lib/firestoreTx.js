const { db } = require('./firebase');
const logger = require('./logger');

/**
 * Shared Firestore transaction helpers for counters and rankings
 * Ensures consistency across posts, comments, votes, and men-reviews
 */

/**
 * Execute a transaction with retry logic and proper error handling
 * @param {Function} updateFunction - Function that performs the transaction updates
 * @param {number} maxAttempts - Maximum retry attempts (default: 5)
 * @returns {Promise<any>} Transaction result
 */
async function runTransaction(updateFunction, maxAttempts = 5) {
  let attempt = 1;
  
  while (attempt <= maxAttempts) {
    try {
      const result = await db.runTransaction(updateFunction);
      logger.debug('Transaction completed successfully', { attempt });
      return result;
    } catch (error) {
      if (error.code === 'ABORTED' && attempt < maxAttempts) {
        // Retry on abort (concurrent modification)
        logger.warn('Transaction aborted, retrying', { 
          attempt, 
          maxAttempts, 
          error: error.message 
        });
        attempt++;
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
        continue;
      }
      
      // Log the error and rethrow
      logger.error('Transaction failed permanently', {
        attempt,
        error: error.message,
        code: error.code,
        stack: error.stack
      });
      throw error;
    }
  }
  
  throw new Error(`Transaction failed after ${maxAttempts} attempts`);
}

/**
 * Update a counter atomically within a transaction
 * @param {string} docPath - Document path to update
 * @param {string} field - Counter field name
 * @param {number} delta - Change in value (positive or negative)
 * @param {Object} additionalUpdates - Additional fields to update
 * @returns {Promise<void>}
 */
async function updateCounter(docPath, field, delta, additionalUpdates = {}) {
  return runTransaction(async (transaction) => {
    const docRef = db.doc(docPath);
    const doc = await transaction.get(docRef);
    
    if (!doc.exists) {
      throw new Error(`Document not found: ${docPath}`);
    }
    
    const currentValue = doc.data()[field] || 0;
    const newValue = Math.max(0, currentValue + delta); // Prevent negative values
    
    const updates = {
      [field]: newValue,
      updatedAt: new Date(),
      ...additionalUpdates
    };
    
    transaction.update(docRef, updates);
    
    logger.debug('Counter updated in transaction', {
      docPath,
      field,
      oldValue: currentValue,
      newValue,
      delta
    });
  });
}

/**
 * Update multiple counters atomically within a single transaction
 * @param {Array<{docPath: string, field: string, delta: number, additionalUpdates?: Object}>} counterUpdates
 * @returns {Promise<void>}
 */
async function updateMultipleCounters(counterUpdates) {
  return runTransaction(async (transaction) => {
    const updates = [];
    
    // First pass: read all documents
    for (const update of counterUpdates) {
      const docRef = db.doc(update.docPath);
      const doc = await transaction.get(docRef);
      
      if (!doc.exists) {
        throw new Error(`Document not found: ${update.docPath}`);
      }
      
      const currentValue = doc.data()[update.field] || 0;
      const newValue = Math.max(0, currentValue + update.delta);
      
      updates.push({
        docRef,
        newValue,
        additionalUpdates: update.additionalUpdates || {}
      });
    }
    
    // Second pass: apply all updates
    for (const update of updates) {
      const updateData = {
        [counterUpdates.find(u => u.docPath === update.docRef.path).field]: update.newValue,
        updatedAt: new Date(),
        ...update.additionalUpdates
      };
      
      transaction.update(update.docRef, updateData);
    }
    
    logger.debug('Multiple counters updated in transaction', {
      count: counterUpdates.length,
      updates: counterUpdates.map(u => ({ path: u.docPath, field: u.field, delta: u.delta }))
    });
  });
}

/**
 * Batch write with transaction safety for multiple operations
 * @param {Array<{type: 'create'|'update'|'delete', docPath: string, data?: Object}>} operations
 * @returns {Promise<void>}
 */
async function batchWriteWithTransaction(operations) {
  return runTransaction(async (transaction) => {
    for (const operation of operations) {
      const docRef = db.doc(operation.docPath);
      
      switch (operation.type) {
        case 'create':
          transaction.set(docRef, {
            ...operation.data,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          break;
          
        case 'update':
          transaction.update(docRef, {
            ...operation.data,
            updatedAt: new Date()
          });
          break;
          
        case 'delete':
          transaction.delete(docRef);
          break;
          
        default:
          throw new Error(`Invalid operation type: ${operation.type}`);
      }
    }
    
    logger.debug('Batch write completed in transaction', {
      operationCount: operations.length,
      operations: operations.map(op => ({ type: op.type, path: op.docPath }))
    });
  });
}

/**
 * Conditional update that only applies if the document meets certain criteria
 * @param {string} docPath - Document path to update
 * @param {Object} conditions - Conditions that must be met
 * @param {Object} updates - Updates to apply if conditions are met
 * @returns {Promise<boolean>} True if update was applied, false if conditions not met
 */
async function conditionalUpdate(docPath, conditions, updates) {
  try {
    const result = await runTransaction(async (transaction) => {
      const docRef = db.doc(docPath);
      const doc = await transaction.get(docRef);
      
      if (!doc.exists) {
        return false;
      }
      
      const data = doc.data();
      
      // Check all conditions
      for (const [field, expectedValue] of Object.entries(conditions)) {
        if (data[field] !== expectedValue) {
          return false;
        }
      }
      
      // Apply updates
      transaction.update(docRef, {
        ...updates,
        updatedAt: new Date()
      });
      
      return true;
    });
    
    return result;
  } catch (error) {
    logger.error('Conditional update failed', {
      docPath,
      conditions,
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  runTransaction,
  updateCounter,
  updateMultipleCounters,
  batchWriteWithTransaction,
  conditionalUpdate
};

