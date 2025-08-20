const express = require('express');
const { authenticateToken } = require('../../middlewares/auth');
const { generalRateLimiter } = require('../../middlewares/rateLimit');
const {
  createCommunityValidation,
  updateCommunityValidation,
  listCommunitiesValidation,
  getCommunityValidation,
  joinLeaveCommunityValidation,
  getModeratorsValidation,
  validate,
} = require('./validators');
const {
  createCommunity,
  getCommunity,
  listCommunities,
  updateCommunity,
  joinCommunity,
  leaveCommunity,
  getModerators,
} = require('./controller');

const router = express.Router();

/**
 * Communities API Routes
 * All routes are prefixed with /api/v1/communities
 */

// Create community (requires authentication)
router.post(
  '/',
  authenticateToken,
  generalRateLimiter,
  createCommunityValidation,
  validate,
  createCommunity
);

// List communities (public, but can be filtered by user preferences)
router.get('/', listCommunitiesValidation, validate, listCommunities);

// Get community by ID (public)
router.get('/:id', getCommunityValidation, validate, getCommunity);

// Update community (requires authentication + ownership/moderation)
router.patch(
  '/:id',
  authenticateToken,
  generalRateLimiter,
  updateCommunityValidation,
  validate,
  updateCommunity
);

// Join community (requires authentication)
router.post(
  '/:id/join',
  authenticateToken,
  generalRateLimiter,
  joinLeaveCommunityValidation,
  validate,
  joinCommunity
);

// Leave community (requires authentication)
router.post(
  '/:id/leave',
  authenticateToken,
  generalRateLimiter,
  joinLeaveCommunityValidation,
  validate,
  leaveCommunity
);

// Get community moderators (public)
router.get('/:id/moderators', getModeratorsValidation, validate, getModerators);

module.exports = router;
