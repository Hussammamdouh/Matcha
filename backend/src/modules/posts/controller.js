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
    const { uid } = req.user;
    const postData = req.body;

    // Get user nickname from user document
    const userDoc = await req.app.locals.db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
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

    logger.info('Creating post', {
      userId: uid,
      communityId: postData.communityId,
      hasMedia: !!(postData.mediaDescriptors && postData.mediaDescriptors.length),
    });

    const post = await postsService.createPost(postData, uid, userNickname);

    res.status(201).json({
      ok: true,
      data: post,
      meta: {
        message: 'Post created successfully',
      },
    });
  } catch (error) {
    logger.error('Failed to create post', {
      error: error.message,
      userId: req.user?.uid,
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
  updatePost,
  deletePost,
  voteOnPost,
  savePost,
  unsavePost,
  getHomeFeed,
  getCommunityPosts,
  getSavedPosts,
};
