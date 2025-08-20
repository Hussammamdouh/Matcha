const express = require('express');
const { authenticateToken } = require('../../middlewares/auth');
const { generalRateLimiter } = require('../../middlewares/rateLimit');
const {
  globalSearchValidation,
  postSearchValidation,
  communitySearchValidation,
  userSearchValidation,
  trendingPostsValidation,
  validate,
} = require('./validators');
const {
  globalSearch,
  searchPosts,
  searchCommunities,
  searchUsers,
  getTrendingPosts,
} = require('./controller');

const router = express.Router();

// Global search across all content types
router.get(
  '/',
  authenticateToken,
  generalRateLimiter,
  globalSearchValidation,
  validate,
  globalSearch
);

// Search specific content types
router.get(
  '/posts',
  authenticateToken,
  generalRateLimiter,
  postSearchValidation,
  validate,
  searchPosts
);
router.get('/communities', communitySearchValidation, validate, searchCommunities);
router.get(
  '/users',
  authenticateToken,
  generalRateLimiter,
  userSearchValidation,
  validate,
  searchUsers
);

// Trending posts
router.get('/trending', trendingPostsValidation, validate, getTrendingPosts);

module.exports = router;
