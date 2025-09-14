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
 * Post Comments API Routes
 * All routes are prefixed with /api/v1/posts/:postId/comments
 */

// Get post comments (public)
router.get('/:postId/comments', getPostCommentsValidation, validate, getPostComments);

// Create comment for a post (requires authentication)
router.post(
  '/:postId/comments',
  authenticateToken,
  generalRateLimiter,
  createCommentValidation,
  validate,
  createComment
);

// Get specific comment by ID (public)
router.get('/:postId/comments/:commentId', getCommentValidation, validate, getComment);

// Update comment (requires authentication + authorship)
router.patch(
  '/:postId/comments/:commentId',
  authenticateToken,
  generalRateLimiter,
  updateCommentValidation,
  validate,
  updateComment
);

// Delete comment (requires authentication + authorship/moderation)
router.delete(
  '/:postId/comments/:commentId',
  authenticateToken,
  generalRateLimiter,
  getCommentValidation,
  validate,
  deleteComment
);

// Vote on comment (requires authentication)
router.post(
  '/:postId/comments/:commentId/vote',
  authenticateToken,
  generalRateLimiter,
  voteCommentValidation,
  validate,
  voteOnComment
);

// Get comment thread (public)
router.get('/:postId/comments/:commentId/thread', getCommentValidation, validate, getCommentThread);

// Get comment statistics (public)
router.get('/:postId/comments/:commentId/stats', getCommentValidation, validate, getCommentStats);

module.exports = router;
