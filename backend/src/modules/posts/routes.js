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
  listPosts,
  updatePost,
  deletePost,
  voteOnPost,
  savePost,
  unsavePost,
  getHomeFeed,
  getUnifiedHomeFeed,
  getRecommendedCommunities,
  getCommunityPosts,
  getSavedPosts,
} = require('./controller');


const router = express.Router();

/**
 * Posts API Routes
 * All routes are prefixed with /api/v1/posts
 */

// List posts (public)
router.get('/', listPosts);

// Create post (requires authentication)
const directUpload = require('../../middlewares/directUpload');
router.post(
  '/',
  authenticateToken,
  generalRateLimiter,
  directUpload({ namespace: 'posts' }),
  createPostValidation,
  validate,
  createPost
);

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

// Toggle like (upvote/unlike) for a post
router.post(
  '/:id/toggle-like',
  authenticateToken,
  generalRateLimiter,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.uid;
      const votesService = require('../votes/service');

      const current = await votesService.getUserPostVote(id, userId);
      const nextValue = current === 1 ? 0 : 1;
      const result = await votesService.voteOnPost(id, userId, nextValue);

      return res.json({ ok: true, data: { liked: nextValue === 1, ...result } });
    } catch (error) {
      return res.status(500).json({ ok: false, error: { code: 'TOGGLE_LIKE_FAILED', message: 'Failed to toggle like' } });
    }
  }
);

// Unified vote endpoint - supports both posts and comments
// POST /api/v1/vote { entityType: 'post'|'comment', entityId: '...', value: 1|-1|0 }
router.post(
  '/vote',
  authenticateToken,
  generalRateLimiter,
  async (req, res) => {
    try {
      const { entityType, entityId, value } = req.body;
      const userId = req.user.uid;

      if (!entityType || !entityId || value === undefined) {
        return res.status(400).json({
          ok: false,
          error: { code: 'MISSING_PARAMETERS', message: 'entityType, entityId, and value are required' }
        });
      }

      if (!['post', 'comment'].includes(entityType)) {
        return res.status(400).json({
          ok: false,
          error: { code: 'INVALID_ENTITY_TYPE', message: 'entityType must be post or comment' }
        });
      }

      if (![-1, 0, 1].includes(value)) {
        return res.status(400).json({
          ok: false,
          error: { code: 'INVALID_VOTE_VALUE', message: 'value must be -1, 0, or 1' }
        });
      }

      const votesService = require('../votes/service');
      let result;
      
      if (entityType === 'post') {
        result = await votesService.voteOnPost(entityId, userId, value);
      } else {
        result = await votesService.voteOnComment(entityId, userId, value);
      }

      res.json({
        ok: true,
        data: {
          entityType,
          entityId,
          userVote: result.userVote,
          upvotes: result.upvotes,
          downvotes: result.downvotes,
          score: result.score,
          hotScore: result.hotScore || null
        }
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: { code: 'VOTE_FAILED', message: 'Failed to process vote' }
      });
    }
  }
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

// Unified save/unsave toggle endpoint
// POST /api/v1/posts/:id/toggle-save { action: 'save'|'unsave' } or just POST to toggle
router.post(
  '/:id/toggle-save',
  authenticateToken,
  generalRateLimiter,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body;
      const userId = req.user.uid;

      // Check if post is already saved
      const { getFirestore } = require('../../../lib/firebase');
      const firestore = getFirestore();
      const savedDoc = await firestore
        .collection('users')
        .doc(userId)
        .collection('savedPosts')
        .doc(id)
        .get();

      const isCurrentlySaved = savedDoc.exists;
      let shouldSave;

      if (action) {
        // Explicit action provided
        shouldSave = action === 'save';
      } else {
        // Toggle based on current state
        shouldSave = !isCurrentlySaved;
      }

      if (shouldSave && !isCurrentlySaved) {
        // Save the post
        return savePost(req, res);
      } else if (!shouldSave && isCurrentlySaved) {
        // Unsave the post
        return unsavePost(req, res);
      } else {
        // Already in desired state
        res.json({
          ok: true,
          data: {
            postId: id,
            saved: shouldSave,
            message: `Post is already ${shouldSave ? 'saved' : 'unsaved'}`
          }
        });
      }
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: { code: 'SAVE_TOGGLE_FAILED', message: 'Failed to toggle save status' }
      });
    }
  }
);

// Feed routes
// GET /api/v1/posts/feed/home - Home feed (posts from followed users and joined communities)
router.get(
  '/feed/home',
  authenticateToken,
  generalRateLimiter,
  getFeedValidation,
  validate,
  getHomeFeed
);

// GET /api/v1/posts/feed/unified - Unified home feed (posts + men reviews from joined communities)
router.get(
  '/feed/unified',
  authenticateToken,
  generalRateLimiter,
  getFeedValidation,
  validate,
  getUnifiedHomeFeed
);

// GET /api/v1/posts/feed/recommendations - Recommended communities for new users
router.get(
  '/feed/recommendations',
  authenticateToken,
  generalRateLimiter,
  getRecommendedCommunities
);

// GET /api/v1/posts/feed/saved - Saved posts feed
router.get(
  '/feed/saved',
  authenticateToken,
  generalRateLimiter,
  getSavedPostsValidation,
  validate,
  getSavedPosts
);

module.exports = router;
