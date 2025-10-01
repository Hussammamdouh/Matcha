const { getFirestore, setUserCustomClaims } = require('../../../lib/firebase');
const { createRequestLogger } = require('../../lib/logger');
const { createError, ErrorCodes } = require('../../middlewares/error');

/**
 * Get all pending admin reviews for gender verification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getPendingReviews(req, res) {
  const logger = createRequestLogger(req.id);
  
  try {
    const db = getFirestore();
    
    const reviewsSnapshot = await db
      .collection('admin_reviews')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();
    
    const reviews = [];
    for (const doc of reviewsSnapshot.docs) {
      const review = { id: doc.id, ...doc.data() };
      
      // Get user details
      const userDoc = await db.collection('users').doc(review.userId).get();
      if (userDoc.exists) {
        review.userDetails = userDoc.data();
      }
      
      reviews.push(review);
    }
    
    logger.info('Retrieved pending admin reviews', { count: reviews.length });
    
    return res.status(200).json({
      ok: true,
      data: { reviews },
      count: reviews.length
    });
  } catch (error) {
    logger.error('Failed to get pending reviews', { error: error.message });
    return res.status(500).json({
      ok: false,
      error: {
        code: 'ADMIN_REVIEWS_FETCH_FAILED',
        message: 'Failed to fetch pending reviews'
      }
    });
  }
}

/**
 * Approve a user after manual admin review
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function approveUser(req, res) {
  const logger = createRequestLogger(req.id);
  const { reviewId } = req.params;
  const { adminNotes } = req.body;
  
  try {
    const db = getFirestore();
    
    // Get the review document
    const reviewDoc = await db.collection('admin_reviews').doc(reviewId).get();
    if (!reviewDoc.exists) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'REVIEW_NOT_FOUND',
          message: 'Admin review not found'
        }
      });
    }
    
    const review = reviewDoc.data();
    if (review.status !== 'pending') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'REVIEW_ALREADY_PROCESSED',
          message: 'Review has already been processed'
        }
      });
    }
    
    const userId = review.userId;
    
    // Update user status to approved
    await setUserCustomClaims(userId, { role: 'user', gv: 'approved' });
    await db.collection('users').doc(userId).update({
      genderVerificationStatus: 'approved',
      adminApprovalData: {
        reviewId,
        approvedAt: new Date(),
        adminNotes: adminNotes || 'Approved by admin after manual review'
      },
      updatedAt: new Date()
    });
    
    // Update review status
    await db.collection('admin_reviews').doc(reviewId).update({
      status: 'approved',
      approvedAt: new Date(),
      adminNotes: adminNotes || 'Approved by admin after manual review',
      adminId: req.user?.uid || 'system'
    });
    
    logger.info('User approved by admin', { userId, reviewId, adminNotes });
    
    return res.status(200).json({
      ok: true,
      data: {
        message: 'User approved successfully',
        userId,
        reviewId
      }
    });
  } catch (error) {
    logger.error('Failed to approve user', { error: error.message, reviewId });
    return res.status(500).json({
      ok: false,
      error: {
        code: 'USER_APPROVAL_FAILED',
        message: 'Failed to approve user'
      }
    });
  }
}

/**
 * Reject a user after manual admin review
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function rejectUser(req, res) {
  const logger = createRequestLogger(req.id);
  const { reviewId } = req.params;
  const { adminNotes, sendToIT = false } = req.body;
  
  try {
    const db = getFirestore();
    
    // Get the review document
    const reviewDoc = await db.collection('admin_reviews').doc(reviewId).get();
    if (!reviewDoc.exists) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'REVIEW_NOT_FOUND',
          message: 'Admin review not found'
        }
      });
    }
    
    const review = reviewDoc.data();
    if (review.status !== 'pending') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'REVIEW_ALREADY_PROCESSED',
          message: 'Review has already been processed'
        }
      });
    }
    
    const userId = review.userId;
    
    // Update user status to rejected
    await setUserCustomClaims(userId, { role: 'user', gv: 'rejected' });
    await db.collection('users').doc(userId).update({
      genderVerificationStatus: 'rejected',
      adminRejectionData: {
        reviewId,
        rejectedAt: new Date(),
        adminNotes: adminNotes || 'Rejected by admin after manual review'
      },
      updatedAt: new Date()
    });
    
    // Update review status
    await db.collection('admin_reviews').doc(reviewId).update({
      status: 'rejected',
      rejectedAt: new Date(),
      adminNotes: adminNotes || 'Rejected by admin after manual review',
      adminId: req.user?.uid || 'system'
    });
    
    // If sendToIT is true, create IT ticket for IP banning
    if (sendToIT) {
      await db.collection('it_tickets').add({
        type: 'admin_rejection',
        userId,
        reason: 'admin_rejected',
        reviewId,
        adminNotes,
        action: 'ban_ip',
        createdAt: new Date(),
        status: 'open',
        priority: 'high'
      });
    }
    
    logger.info('User rejected by admin', { userId, reviewId, adminNotes, sendToIT });
    
    return res.status(200).json({
      ok: true,
      data: {
        message: 'User rejected successfully',
        userId,
        reviewId,
        sentToIT: sendToIT
      }
    });
  } catch (error) {
    logger.error('Failed to reject user', { error: error.message, reviewId });
    return res.status(500).json({
      ok: false,
      error: {
        code: 'USER_REJECTION_FAILED',
        message: 'Failed to reject user'
      }
    });
  }
}

/**
 * Get admin review statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getAdminStats(req, res) {
  const logger = createRequestLogger(req.id);
  
  try {
    const db = getFirestore();
    
    // Get counts for different review statuses
    const [pendingSnapshot, approvedSnapshot, rejectedSnapshot] = await Promise.all([
      db.collection('admin_reviews').where('status', '==', 'pending').get(),
      db.collection('admin_reviews').where('status', '==', 'approved').get(),
      db.collection('admin_reviews').where('status', '==', 'rejected').get()
    ]);
    
    const stats = {
      pending: pendingSnapshot.size,
      approved: approvedSnapshot.size,
      rejected: rejectedSnapshot.size,
      total: pendingSnapshot.size + approvedSnapshot.size + rejectedSnapshot.size
    };
    
    logger.info('Retrieved admin statistics', stats);
    
    return res.status(200).json({
      ok: true,
      data: { stats }
    });
  } catch (error) {
    logger.error('Failed to get admin stats', { error: error.message });
    return res.status(500).json({
      ok: false,
      error: {
        code: 'ADMIN_STATS_FETCH_FAILED',
        message: 'Failed to fetch admin statistics'
      }
    });
  }
}

module.exports = {
  getPendingReviews,
  approveUser,
  rejectUser,
  getAdminStats
};