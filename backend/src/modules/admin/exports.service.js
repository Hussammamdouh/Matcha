const { getFirestore, getStorage } = require('../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');
const crypto = require('crypto');

let db;
let storage;
let bucket;
const logger = createModuleLogger('admin:exports:service');

function ensureInitialized() {
  if (!db || !storage || !bucket) {
    db = getFirestore();
    storage = getStorage();
    bucket = storage.bucket();
  }
}

/**
 * Create a content export job for a user
 * @param {string} userId - User ID to export content for
 * @param {string} adminId - ID of the admin requesting export
 * @param {Object} options - Export options
 * @returns {Promise<Object>} Export job details
 */
async function createExportJob(userId, adminId, options = {}) {
  ensureInitialized();
  try {
    // Check if user exists
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw new Error('User not found');
    }
    
    // Generate unique job ID
    const jobId = crypto.randomUUID();
    
    // Create export job record
    const exportJob = {
      id: jobId,
      userId,
      requestedBy: adminId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      options: {
        includePosts: options.includePosts !== false,
        includeComments: options.includeComments !== false,
        includeMessages: options.includeMessages !== false,
        includeMenSubjects: options.includeMenSubjects !== false,
        includeReports: options.includeReports !== false,
        ...options,
      },
      progress: {
        current: 0,
        total: 0,
        stage: 'initializing',
      },
      result: null,
      error: null,
    };
    
    // Save to Firestore
    await db.collection('export_jobs').doc(jobId).set(exportJob);
    
    // Start the export process asynchronously
    processExportJob(jobId).catch(error => {
      logger.error('Export job failed', {
        jobId,
        userId,
        error: error.message,
      });
    });
    
    logger.info('Export job created', {
      jobId,
      userId,
      adminId,
      options: exportJob.options,
    });
    
    return {
      jobId,
      status: 'pending',
      message: 'Export job created and queued for processing',
    };
  } catch (error) {
    logger.error('Failed to create export job', {
      error: error.message,
      userId,
      adminId,
    });
    throw error;
  }
}

/**
 * Process an export job (runs asynchronously)
 * @param {string} jobId - Export job ID
 */
async function processExportJob(jobId) {
  ensureInitialized();
  try {
    const jobRef = db.collection('export_jobs').doc(jobId);
    
    // Update status to processing
    await jobRef.update({
      status: 'processing',
      progress: {
        current: 0,
        total: 0,
        stage: 'collecting_data',
      },
      updatedAt: new Date(),
    });
    
    // Get job details
    const jobDoc = await jobRef.get();
    const job = jobDoc.data();
    
    const { userId, options } = job;
    
    // Collect user data
    const userData = await collectUserData(userId, options);
    
    // Update progress
    await jobRef.update({
      progress: {
        current: 1,
        total: 1,
        stage: 'writing_file',
      },
      updatedAt: new Date(),
    });
    
    // Write to Storage
    const fileName = `exports/${jobId}.json`;
    const file = bucket.file(fileName);
    
    const jsonContent = JSON.stringify(userData, null, 2);
    await file.save(jsonContent, {
      metadata: {
        contentType: 'application/json',
        metadata: {
          jobId,
          userId,
          exportedAt: new Date().toISOString(),
          exportedBy: job.requestedBy,
        },
      },
    });
    
    // Generate signed URL for download
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });
    
    // Update job as completed
    await jobRef.update({
      status: 'completed',
      progress: {
        current: 1,
        total: 1,
        stage: 'completed',
      },
      result: {
        fileName,
        downloadUrl: signedUrl,
        recordCount: userData.summary.totalRecords,
        fileSize: Buffer.byteLength(jsonContent, 'utf8'),
      },
      updatedAt: new Date(),
      completedAt: new Date(),
    });
    
    logger.info('Export job completed', {
      jobId,
      userId,
      recordCount: userData.summary.totalRecords,
      fileSize: Buffer.byteLength(jsonContent, 'utf8'),
    });
    
  } catch (error) {
    logger.error('Export job processing failed', {
      error: error.message,
      jobId,
    });
    
    // Update job as failed
    const jobRef = db.collection('export_jobs').doc(jobId);
    await jobRef.update({
      status: 'failed',
      error: {
        message: error.message,
        timestamp: new Date(),
      },
      updatedAt: new Date(),
    });
  }
}

/**
 * Collect user data for export
 * @param {string} userId - User ID
 * @param {Object} options - Export options
 * @returns {Promise<Object>} Collected user data
 */
async function collectUserData(userId, options) {
  ensureInitialized();
  const userData = {
    userId,
    exportedAt: new Date().toISOString(),
    summary: {
      totalRecords: 0,
      posts: 0,
      comments: 0,
      messages: 0,
      menSubjects: 0,
      reports: 0,
    },
    data: {},
  };
  
  try {
    // Get user profile
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userProfile = userDoc.data();
      userData.data.profile = {
        nickname: userProfile.nickname,
        email: userProfile.email,
        role: userProfile.role,
        status: userProfile.status,
        isShadowbanned: userProfile.isShadowbanned,
        createdAt: userProfile.createdAt,
        updatedAt: userProfile.updatedAt,
        // Include moderation fields
        ...(userProfile.suspendedAt && { suspendedAt: userProfile.suspendedAt }),
        ...(userProfile.suspensionReason && { suspensionReason: userProfile.suspensionReason }),
        ...(userProfile.shadowbannedAt && { shadowbannedAt: userProfile.shadowbannedAt }),
        ...(userProfile.shadowbanReason && { shadowbanReason: userProfile.shadowbanReason }),
      };
    }
    
    // Collect posts if requested
    if (options.includePosts) {
      const postsQuery = await db
        .collection('posts')
        .where('authorId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      const posts = postsQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      userData.data.posts = posts;
      userData.summary.posts = posts.length;
      userData.summary.totalRecords += posts.length;
    }
    
    // Collect comments if requested
    if (options.includeComments) {
      const commentsQuery = await db
        .collection('comments')
        .where('authorId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      const comments = commentsQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      userData.data.comments = comments;
      userData.summary.comments = comments.length;
      userData.summary.totalRecords += comments.length;
    }
    
    // Collect chat messages if requested
    if (options.includeMessages) {
      const messagesQuery = await db
        .collection('messages')
        .where('authorId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      const messages = messagesQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      userData.data.messages = messages;
      userData.summary.messages = messages.length;
      userData.summary.totalRecords += messages.length;
    }
    
    // Collect men-review subjects if requested
    if (options.includeMenSubjects) {
      const menSubjectsQuery = await db
        .collection('men_subjects')
        .where('creatorId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      const menSubjects = menSubjectsQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      userData.data.menSubjects = menSubjects;
      userData.summary.menSubjects = menSubjects.length;
      userData.summary.totalRecords += menSubjects.length;
    }
    
    // Collect reports if requested
    if (options.includeReports) {
      // Feed reports
      const feedReportsQuery = await db
        .collection('reports')
        .where('reporterId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      const feedReports = feedReportsQuery.docs.map(doc => ({
        id: doc.id,
        surface: 'feed',
        ...doc.data(),
      }));
      
      // Chat reports
      const chatReportsQuery = await db
        .collection('chat_reports')
        .where('reporterId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      const chatReports = chatReportsQuery.docs.map(doc => ({
        id: doc.id,
        surface: 'chat',
        ...doc.data(),
      }));
      
      // Men reports
      const menReportsQuery = await db
        .collection('men_reports')
        .where('reporterId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      const menReports = menReportsQuery.docs.map(doc => ({
        id: doc.id,
        surface: 'men',
        ...doc.data(),
      }));
      
      const allReports = [...feedReports, ...chatReports, ...menReports];
      
      userData.data.reports = allReports;
      userData.summary.reports = allReports.length;
      userData.summary.totalRecords += allReports.length;
    }
    
    return userData;
    
  } catch (error) {
    logger.error('Failed to collect user data', {
      error: error.message,
      userId,
      options,
    });
    throw error;
  }
}

/**
 * Get export job status
 * @param {string} jobId - Export job ID
 * @returns {Promise<Object|null>} Export job details or null if not found
 */
async function getExportJob(jobId) {
  ensureInitialized();
  try {
    const jobDoc = await db.collection('export_jobs').doc(jobId).get();
    
    if (!jobDoc.exists) {
      return null;
    }
    
    const job = jobDoc.data();
    
    // Generate fresh download URL if job is completed
    if (job.status === 'completed' && job.result && job.result.fileName) {
      try {
        const file = bucket.file(job.result.fileName);
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        });
        
        job.result.downloadUrl = signedUrl;
      } catch (urlError) {
        logger.warn('Failed to generate fresh download URL', {
          jobId,
          error: urlError.message,
        });
      }
    }
    
    return {
      id: jobId,
      ...job,
    };
  } catch (error) {
    logger.error('Failed to get export job', {
      error: error.message,
      jobId,
    });
    throw error;
  }
}

/**
 * List export jobs with filtering and pagination
 * @param {Object} options - Query options
 * @param {string} options.userId - Filter by user ID
 * @param {string} options.status - Filter by status
 * @param {string} options.requestedBy - Filter by requesting admin
 * @param {string} options.cursor - Pagination cursor
 * @param {number} options.limit - Maximum number of results (max 50)
 * @returns {Promise<Object>} Paginated export jobs
 */
async function listExportJobs(options = {}) {
  ensureInitialized();
  try {
    const { userId, status, requestedBy, cursor, limit = 20 } = options;
    
    // Enforce limit
    const queryLimit = Math.min(limit, 50);
    
    let query = db.collection('export_jobs');
    
    // Apply filters
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    if (requestedBy) {
      query = query.where('requestedBy', '==', requestedBy);
    }
    
    // Order by creation date (newest first)
    query = query.orderBy('createdAt', 'desc');
    
    // Apply cursor if provided
    if (cursor) {
      const cursorDoc = await db.collection('export_jobs').doc(cursor).get();
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
    const jobs = results.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Generate next cursor
    let nextCursor = null;
    if (hasMore && jobs.length > 0) {
      nextCursor = jobs[jobs.length - 1].id;
    }
    
    logger.debug('Export jobs retrieved', {
      count: jobs.length,
      hasMore,
      filters: { userId, status, requestedBy },
    });
    
    return {
      data: jobs,
      meta: {
        count: jobs.length,
        hasMore,
        nextCursor,
        limit: queryLimit,
      },
    };
  } catch (error) {
    logger.error('Failed to list export jobs', {
      error: error.message,
      options,
    });
    throw error;
  }
}

/**
 * Cancel an export job
 * @param {string} jobId - Export job ID
 * @param {string} adminId - ID of the admin cancelling the job
 * @returns {Promise<Object>} Cancellation result
 */
async function cancelExportJob(jobId, adminId) {
  ensureInitialized();
  try {
    const jobRef = db.collection('export_jobs').doc(jobId);
    
    const result = await db.runTransaction(async (transaction) => {
      const jobDoc = await transaction.get(jobRef);
      
      if (!jobDoc.exists) {
        throw new Error('Export job not found');
      }
      
      const job = jobDoc.data();
      
      if (job.status === 'completed' || job.status === 'failed') {
        throw new Error('Cannot cancel completed or failed job');
      }
      
      if (job.status === 'cancelled') {
        throw new Error('Job is already cancelled');
      }
      
      const updates = {
        status: 'cancelled',
        cancelledBy: adminId,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      };
      
      transaction.update(jobRef, updates);
      
      return {
        id: jobId,
        ...job,
        ...updates,
      };
    });
    
    logger.info('Export job cancelled', {
      jobId,
      adminId,
    });
    
    return result;
  } catch (error) {
    logger.error('Failed to cancel export job', {
      error: error.message,
      jobId,
      adminId,
    });
    throw error;
  }
}

/**
 * Delete an export job and its associated file
 * @param {string} jobId - Export job ID
 * @param {string} adminId - ID of the admin deleting the job
 * @returns {Promise<Object>} Deletion result
 */
async function deleteExportJob(jobId, adminId) {
  ensureInitialized();
  try {
    const jobRef = db.collection('export_jobs').doc(jobId);
    
    const result = await db.runTransaction(async (transaction) => {
      const jobDoc = await transaction.get(jobRef);
      
      if (!jobDoc.exists) {
        throw new Error('Export job not found');
      }
      
      const job = jobDoc.data();
      
      // Delete associated file from Storage if it exists
      if (job.result && job.result.fileName) {
        try {
          const file = bucket.file(job.result.fileName);
          await file.delete();
        } catch (deleteError) {
          logger.warn('Failed to delete export file', {
            jobId,
            fileName: job.result.fileName,
            error: deleteError.message,
          });
        }
      }
      
      // Delete job record
      transaction.delete(jobRef);
      
      return {
        id: jobId,
        message: 'Export job and associated file deleted successfully',
      };
    });
    
    logger.info('Export job deleted', {
      jobId,
      adminId,
    });
    
    return result;
  } catch (error) {
    logger.error('Failed to delete export job', {
      error: error.message,
      jobId,
      adminId,
    });
    throw error;
  }
}

module.exports = {
  createExportJob,
  getExportJob,
  listExportJobs,
  cancelExportJob,
  deleteExportJob,
};
