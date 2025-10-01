const express = require('express');
const { body, param } = require('express-validator');
const { authenticateToken } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { asyncHandler } = require('../../middlewares/error');
const adminController = require('./controller');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole('admin'));

// Get all pending admin reviews
router.get('/reviews', asyncHandler(adminController.getPendingReviews));

// Approve a user after manual admin review
router.post(
  '/reviews/:reviewId/approve',
  [
    param('reviewId').isString().notEmpty().withMessage('Review ID is required'),
    body('adminNotes').optional().isString().withMessage('Admin notes must be a string')
  ],
  asyncHandler(adminController.approveUser)
);

// Reject a user after manual admin review
router.post(
  '/reviews/:reviewId/reject',
  [
    param('reviewId').isString().notEmpty().withMessage('Review ID is required'),
    body('adminNotes').optional().isString().withMessage('Admin notes must be a string'),
    body('sendToIT').optional().isBoolean().withMessage('sendToIT must be a boolean')
  ],
  asyncHandler(adminController.rejectUser)
);

// Get admin dashboard statistics
router.get('/stats', asyncHandler(adminController.getAdminStats));

module.exports = router;
