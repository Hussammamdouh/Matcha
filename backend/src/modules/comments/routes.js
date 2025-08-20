const express = require('express');
const { authenticateToken } = require('../../middlewares/auth');
const { generalRateLimiter } = require('../../middlewares/rateLimit');
const {
  createCommentValidation,
  updateCommentValidation,
  getCommentValidation,
  voteCommentValidation,
  getPostCommentsValidation,
  validate,
} = require('./validators');
const {
  createComment,
  getComment,
  updateComment,
  deleteComment,
  voteOnComment,
  getPostComments,
  getCommentThread,
  getCommentStats,
} = require('./controller');

const router = express.Router();

/**
 * Comments API Routes
 * All routes are prefixed with /api/v1/comments
 */

// Create comment (requires authentication)
router.post(
  '/',
  authenticateToken,
  generalRateLimiter,
  createCommentValidation,
  validate,
  createComment
);

// Get comment by ID (public)
router.get('/:id', getCommentValidation, validate, getComment);

// Update comment (requires authentication + authorship)
router.patch(
  '/:id',
  authenticateToken,
  generalRateLimiter,
  updateCommentValidation,
  validate,
  updateComment
);

// Delete comment (requires authentication + authorship/moderation)
router.delete(
  '/:id',
  authenticateToken,
  generalRateLimiter,
  getCommentValidation,
  validate,
  deleteComment
);

// Vote on comment (requires authentication)
router.post(
  '/:id/vote',
  authenticateToken,
  generalRateLimiter,
  voteCommentValidation,
  validate,
  voteOnComment
);

// Get comment thread (public)
router.get('/:id/thread', getCommentValidation, validate, getCommentThread);

// Get comment statistics (public)
router.get('/:id/stats', getCommentValidation, validate, getCommentStats);

module.exports = router;
