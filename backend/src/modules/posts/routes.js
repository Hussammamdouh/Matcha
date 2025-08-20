const express = require('express');
const { authenticateToken } = require('../../middlewares/auth');
const { generalRateLimiter } = require('../../middlewares/rateLimit');
const {
  createPostValidation,
  updatePostValidation,
  getPostValidation,
  votePostValidation,
  savePostValidation,
  getFeedValidation,
  getCommunityPostsValidation,
  getSavedPostsValidation,
  validate,
} = require('./validators');
const {
  createPost,
  getPost,
  updatePost,
  deletePost,
  voteOnPost,
  savePost,
  unsavePost,
  getHomeFeed,
  getCommunityPosts,
  getSavedPosts,
} = require('./controller');

const router = express.Router();

/**
 * Posts API Routes
 * All routes are prefixed with /api/v1/posts
 */

// Create post (requires authentication)
router.post('/', authenticateToken, generalRateLimiter, createPostValidation, validate, createPost);

// Get post by ID (public)
router.get('/:id', getPostValidation, validate, getPost);

// Update post (requires authentication + authorship)
router.patch(
  '/:id',
  authenticateToken,
  generalRateLimiter,
  updatePostValidation,
  validate,
  updatePost
);

// Delete post (requires authentication + authorship/moderation)
router.delete(
  '/:id',
  authenticateToken,
  generalRateLimiter,
  getPostValidation,
  validate,
  deletePost
);

// Vote on post (requires authentication)
router.post(
  '/:id/vote',
  authenticateToken,
  generalRateLimiter,
  votePostValidation,
  validate,
  voteOnPost
);

// Save post (requires authentication)
router.post(
  '/:id/save',
  authenticateToken,
  generalRateLimiter,
  savePostValidation,
  validate,
  savePost
);

// Unsave post (requires authentication)
router.delete(
  '/:id/save',
  authenticateToken,
  generalRateLimiter,
  savePostValidation,
  validate,
  unsavePost
);

module.exports = router;
