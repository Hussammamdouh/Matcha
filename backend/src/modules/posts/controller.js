const { createModuleLogger } = require('../../lib/logger');
const postsService = require('./service');
const votesService = require('../votes/service');

const logger = createModuleLogger();

/**
 * Posts controller for Matcha
 * Handles HTTP requests and responses for post operations
 */

/**
 * Create a new post
 * POST /api/v1/posts
 */
async function createPost(req, res) {
  try {
    logger.info('=== POST CREATION START ===', {
      requestId: req.id,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    const { uid } = req.user;
    logger.info('User authentication check', { uid, hasUser: !!req.user });

    if (!uid) {
      logger.error('No user ID found in request');
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
    }

    const postData = req.body;
    logger.info('Request body received', { 
      postData, 
      bodyKeys: Object.keys(postData),
      contentType: req.get('Content-Type')
    });

    // Validate required fields (allow public posts with no communityId)
    if (!postData.title || !postData.body) {
      logger.error('Missing required fields', { 
        hasTitle: !!postData.title, 
        hasBody: !!postData.body, 
        hasCommunityId: !!postData.communityId 
      });
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_FIELDS', message: 'Title and body are required' }
      });
    }

    // Get user nickname from user document
    logger.info('Fetching user document', { uid, collection: 'users' });
    const { db } = require('../../../lib/firebase');
    const userDoc = await db.collection('users').doc(uid).get();
    
    logger.info('User document fetch result', { 
      exists: userDoc.exists, 
      hasData: !!userDoc.data(),
      userId: uid
    });

    if (!userDoc.exists) {
      logger.error('User not found in database', { uid });
      return res.status(404).json({
        ok: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const userData = userDoc.data();
    const userNickname = userData.nickname || 'Anonymous';
    
    logger.info('User data retrieved', { 
      nickname: userNickname, 
      userDataKeys: Object.keys(userData),
      hasNickname: !!userData.nickname
    });

    logger.info('Calling posts service', {
      userId: uid,
      communityId: postData.communityId || null,
      hasMedia: !!(postData.mediaDescriptors && postData.mediaDescriptors.length),
      postDataKeys: Object.keys(postData)
    });

    const post = await postsService.createPost(postData, uid, userNickname);

    logger.info('Post service completed successfully', { 
      postId: post.id,
      postKeys: Object.keys(post)
    });

    res.status(201).json({
      ok: true,
      data: post,
      meta: {
        message: 'Post created successfully',
      },
    });

    logger.info('=== POST CREATION SUCCESS ===', {
      postId: post.id,
      userId: uid,
      communityId: postData.communityId || null
    });

  } catch (error) {
    logger.error('=== POST CREATION FAILED ===', {
      error: error.message,
      errorStack: error.stack,
      errorName: error.name,
      userId: req.user?.uid,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });

    if (error.message.includes('Community not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'COMMUNITY_NOT_FOUND',
          message: 'Community not found',
        },
      });
    }

    if (error.message.includes('Must be a member')) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'NOT_MEMBER',
          message: 'Must be a member to post in private communities',
        },
      });
    }

    if (error.message.includes('Media validation failed')) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'MEDIA_VALIDATION_ERROR',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create post',
      },
    });
  }
}

/**
 * Get post by ID
 * GET /api/v1/posts/:id
 */
async function getPost(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user || {};

    logger.info('Getting post', {
      postId: id,
      userId: uid,
    });

    const post = await postsService.getPost(id, uid);

    if (!post) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Post not found',
        },
      });
    }

    res.json({
      ok: true,
      data: post,
    });
  } catch (error) {
    logger.error('Failed to get post', {
      error: error.message,
      postId: req.params.id,
      userId: req.user?.uid,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get post',
      },
    });
  }
}

/**
 * List posts (optionally filtered)
 * GET /api/v1/posts
 */
async function listPosts(req, res) {
  try {
    const { authorId, communityId, visibility, pageSize, cursor } = req.query;
    const userId = req.user?.uid || null; // Include user ID if authenticated
    const result = await postsService.listPosts({ 
      authorId, 
      communityId, 
      visibility, 
      pageSize: pageSize ? parseInt(pageSize, 10) : 20, 
      cursor,
      userId 
    });
    res.json({ ok: true, data: result.posts, meta: { pagination: result.pagination } });
  } catch (error) {
    const logger = require('../../lib/logger').createRequestLogger(req.id);
    logger.error('Failed to list posts', { error: error.message, stack: error.stack });
    res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list posts' } });
  }
}

/**
 * Update post
 * PATCH /api/v1/posts/:id
 */
async function updatePost(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user;
    const updateData = req.body;

    logger.info('Updating post', {
      postId: id,
      userId: uid,
      updateFields: Object.keys(updateData),
    });

    const post = await postsService.updatePost(id, updateData, uid);

    res.json({
      ok: true,
      data: post,
      meta: {
        message: 'Post updated successfully',
      },
    });
  } catch (error) {
    logger.error('Failed to update post', {
      error: error.message,
      postId: req.params.id,
      userId: req.user?.uid,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Post not found',
        },
      });
    }

    if (error.message.includes('Only the author can edit')) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the author can edit this post',
        },
      });
    }

    if (error.message.includes('Cannot edit deleted post')) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'POST_DELETED',
          message: 'Cannot edit deleted post',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update post',
      },
    });
  }
}

/**
 * Delete post
 * DELETE /api/v1/posts/:id
 */
async function deletePost(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user;

    logger.info('Deleting post', {
      postId: id,
      userId: uid,
    });

    await postsService.deletePost(id, uid);

    res.json({
      ok: true,
      data: null,
      meta: {
        message: 'Post deleted successfully',
      },
    });
  } catch (error) {
    logger.error('Failed to delete post', {
      error: error.message,
      postId: req.params.id,
      userId: req.user?.uid,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Post not found',
        },
      });
    }

    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to delete this post',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete post',
      },
    });
  }
}

/**
 * Vote on post
 * POST /api/v1/posts/:id/vote
 */
async function voteOnPost(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user;
    const { value } = req.body;

    logger.info('Voting on post', {
      postId: id,
      userId: uid,
      value,
    });

    const result = await votesService.voteOnPost(id, uid, value);

    res.json({
      ok: true,
      data: result,
      meta: {
        message: value === 0 ? 'Vote removed' : `Vote ${value === 1 ? 'added' : 'updated'}`,
      },
    });
  } catch (error) {
    logger.error('Failed to vote on post', {
      error: error.message,
      postId: req.params.id,
      userId: req.user?.uid,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Post not found',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to vote on post',
      },
    });
  }
}

/**
 * Save post
 * POST /api/v1/posts/:id/save
 */
async function savePost(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user;

    logger.info('Saving post', {
      postId: id,
      userId: uid,
    });

    const result = await postsService.togglePostSave(id, uid, true);

    res.json({
      ok: true,
      data: result,
      meta: {
        message: 'Post saved successfully',
      },
    });
  } catch (error) {
    logger.error('Failed to save post', {
      error: error.message,
      postId: req.params.id,
      userId: req.user?.uid,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Post not found',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to save post',
      },
    });
  }
}

/**
 * Unsave post
 * DELETE /api/v1/posts/:id/save
 */
async function unsavePost(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user;

    logger.info('Unsaving post', {
      postId: id,
      userId: uid,
    });

    const result = await postsService.togglePostSave(id, uid, false);

    res.json({
      ok: true,
      data: result,
      meta: {
        message: 'Post unsaved successfully',
      },
    });
  } catch (error) {
    logger.error('Failed to unsave post', {
      error: error.message,
      postId: req.params.id,
      userId: req.user?.uid,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Post not found',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to unsave post',
      },
    });
  }
}

/**
 * Get home feed
 * GET /api/v1/feed/home
 */
async function getHomeFeed(req, res) {
  try {
    const { uid } = req.user;
    const { sort = 'hot', pageSize = 20, cursor = null } = req.query;

    logger.info('Getting home feed', {
      userId: uid,
      sort,
      pageSize: parseInt(pageSize),
      hasCursor: !!cursor,
    });

    const result = await postsService.getHomeFeed(uid, {
      sort,
      pageSize: parseInt(pageSize),
      cursor,
    });

    res.json({
      ok: true,
      data: result.posts,
      meta: {
        pagination: result.pagination,
        filters: { sort },
        ...(result.meta || {}), // Include fallback metadata if present
      },
    });
  } catch (error) {
    logger.error('Failed to get home feed', {
      error: error.message,
      userId: req.user?.uid,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get home feed',
      },
    });
  }
}

/**
 * Get unified home feed (posts + men reviews)
 * GET /api/v1/feed/unified
 */
async function getUnifiedHomeFeed(req, res) {
  try {
    const { uid } = req.user;
    const { sort = 'hot', pageSize = 20, cursor = null } = req.query;

    logger.info('Getting unified home feed', {
      userId: uid,
      sort,
      pageSize: parseInt(pageSize),
      hasCursor: !!cursor,
    });

    const result = await postsService.getUnifiedHomeFeed(uid, {
      sort,
      pageSize: parseInt(pageSize),
      cursor,
    });

    res.json({
      ok: true,
      data: result.feed,
      meta: {
        pagination: result.pagination,
        filters: { sort },
        ...(result.meta || {}), // Include fallback metadata if present
      },
    });
  } catch (error) {
    logger.error('Failed to get unified home feed', {
      error: error.message,
      userId: req.user?.uid,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get unified home feed',
      },
    });
  }
}

/**
 * Get recommended communities for users with no communities
 * GET /api/v1/feed/recommendations
 */
async function getRecommendedCommunities(req, res) {
  try {
    const { uid } = req.user;
    const { limit = 10 } = req.query;

    logger.info('Getting recommended communities', {
      userId: uid,
      limit: parseInt(limit),
    });

    const result = await postsService.getRecommendedCommunities(uid, {
      limit: parseInt(limit),
    });

    res.json({
      ok: true,
      data: result.communities,
      meta: {
        ...(result.meta || {}),
        filters: { limit: parseInt(limit) },
      },
    });
  } catch (error) {
    logger.error('Failed to get recommended communities', {
      error: error.message,
      userId: req.user?.uid,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get recommended communities',
      },
    });
  }
}

/**
 * Get community posts
 * GET /api/v1/communities/:communityId/posts
 */
async function getCommunityPosts(req, res) {
  try {
    const { communityId } = req.params;
    const { sort = 'hot', pageSize = 20, cursor = null } = req.query;

    logger.info('Getting community posts', {
      communityId,
      sort,
      pageSize: parseInt(pageSize),
      hasCursor: !!cursor,
    });

    const result = await postsService.getCommunityPosts(communityId, {
      sort,
      pageSize: parseInt(pageSize),
      cursor,
    });

    res.json({
      ok: true,
      data: result.posts,
      meta: {
        pagination: result.pagination,
        filters: { sort },
      },
    });
  } catch (error) {
    logger.error('Failed to get community posts', {
      error: error.message,
      communityId: req.params.communityId,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Community not found',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get community posts',
      },
    });
  }
}

/**
 * Get saved posts
 * GET /api/v1/me/saves
 */
async function getSavedPosts(req, res) {
  try {
    const { uid } = req.user;
    const { pageSize = 20, cursor = null } = req.query;

    logger.info('Getting saved posts', {
      userId: uid,
      pageSize: parseInt(pageSize),
      hasCursor: !!cursor,
    });

    const result = await postsService.getSavedPosts(uid, {
      pageSize: parseInt(pageSize),
      cursor,
    });

    res.json({
      ok: true,
      data: result.posts,
      meta: {
        pagination: result.pagination,
      },
    });
  } catch (error) {
    logger.error('Failed to get saved posts', {
      error: error.message,
      userId: req.user?.uid,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get saved posts',
      },
    });
  }
}

module.exports = {
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
};
