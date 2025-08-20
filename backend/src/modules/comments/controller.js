const { createModuleLogger } = require('../../lib/logger');
const commentsService = require('./service');
const votesService = require('../votes/service');

const logger = createModuleLogger();

/**
 * Comments controller for Matcha
 * Handles HTTP requests and responses for comment operations
 */

/**
 * Create a new comment
 * POST /api/v1/posts/:postId/comments
 */
async function createComment(req, res) {
  try {
    const { postId } = req.params;
    const { uid } = req.user;
    const commentData = req.body;

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

    logger.info('Creating comment', {
      userId: uid,
      postId,
      hasParent: !!commentData.parentId,
    });

    const comment = await commentsService.createComment(commentData, postId, uid, userNickname);

    res.status(201).json({
      ok: true,
      data: comment,
      meta: {
        message: 'Comment created successfully',
      },
    });
  } catch (error) {
    logger.error('Failed to create comment', {
      error: error.message,
      userId: req.user?.uid,
      postId: req.params.postId,
    });

    if (error.message.includes('Post not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: 'Post not found',
        },
      });
    }

    if (error.message.includes('Cannot comment on deleted post')) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'POST_DELETED',
          message: 'Cannot comment on deleted post',
        },
      });
    }

    if (error.message.includes('Parent comment not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'PARENT_COMMENT_NOT_FOUND',
          message: 'Parent comment not found',
        },
      });
    }

    if (error.message.includes('Comment depth cannot exceed')) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'DEPTH_LIMIT_EXCEEDED',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create comment',
      },
    });
  }
}

/**
 * Get comment by ID
 * GET /api/v1/comments/:id
 */
async function getComment(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user || {};

    logger.info('Getting comment', {
      commentId: id,
      userId: uid,
    });

    const comment = await commentsService.getComment(id, uid);

    if (!comment) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Comment not found',
        },
      });
    }

    res.json({
      ok: true,
      data: comment,
    });
  } catch (error) {
    logger.error('Failed to get comment', {
      error: error.message,
      commentId: req.params.id,
      userId: req.user?.uid,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get comment',
      },
    });
  }
}

/**
 * Update comment
 * PATCH /api/v1/comments/:id
 */
async function updateComment(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user;
    const updateData = req.body;

    logger.info('Updating comment', {
      commentId: id,
      userId: uid,
      updateFields: Object.keys(updateData),
    });

    const comment = await commentsService.updateComment(id, updateData, uid);

    res.json({
      ok: true,
      data: comment,
      meta: {
        message: 'Comment updated successfully',
      },
    });
  } catch (error) {
    logger.error('Failed to update comment', {
      error: error.message,
      commentId: req.params.id,
      userId: req.user?.uid,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Comment not found',
        },
      });
    }

    if (error.message.includes('Only the author can edit')) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the author can edit this comment',
        },
      });
    }

    if (error.message.includes('Cannot edit deleted comment')) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'COMMENT_DELETED',
          message: 'Cannot edit deleted comment',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update comment',
      },
    });
  }
}

/**
 * Delete comment
 * DELETE /api/v1/comments/:id
 */
async function deleteComment(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user;

    logger.info('Deleting comment', {
      commentId: id,
      userId: uid,
    });

    await commentsService.deleteComment(id, uid);

    res.json({
      ok: true,
      data: null,
      meta: {
        message: 'Comment deleted successfully',
      },
    });
  } catch (error) {
    logger.error('Failed to delete comment', {
      error: error.message,
      commentId: req.params.id,
      userId: req.user?.uid,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Comment not found',
        },
      });
    }

    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to delete this comment',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete comment',
      },
    });
  }
}

/**
 * Vote on comment
 * POST /api/v1/comments/:id/vote
 */
async function voteOnComment(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user;
    const { value } = req.body;

    logger.info('Voting on comment', {
      commentId: id,
      userId: uid,
      value,
    });

    const result = await votesService.voteOnComment(id, uid, value);

    res.json({
      ok: true,
      data: result,
      meta: {
        message: value === 0 ? 'Vote removed' : `Vote ${value === 1 ? 'added' : 'updated'}`,
      },
    });
  } catch (error) {
    logger.error('Failed to vote on comment', {
      error: error.message,
      commentId: req.params.id,
      userId: req.user?.uid,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Comment not found',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to vote on comment',
      },
    });
  }
}

/**
 * Get post comments
 * GET /api/v1/posts/:postId/comments
 */
async function getPostComments(req, res) {
  try {
    const { postId } = req.params;
    const { uid } = req.user || {};
    const { sort = 'top', pageSize = 20, cursor = null } = req.query;

    logger.info('Getting post comments', {
      postId,
      userId: uid,
      sort,
      pageSize: parseInt(pageSize),
      hasCursor: !!cursor,
    });

    const result = await commentsService.getPostComments(postId, {
      sort,
      pageSize: parseInt(pageSize),
      cursor,
    });

    res.json({
      ok: true,
      data: result.comments,
      meta: {
        pagination: result.pagination,
        filters: { sort },
      },
    });
  } catch (error) {
    logger.error('Failed to get post comments', {
      error: error.message,
      postId: req.params.postId,
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
        message: 'Failed to get post comments',
      },
    });
  }
}

/**
 * Get comment thread
 * GET /api/v1/comments/:id/thread
 */
async function getCommentThread(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user || {};

    logger.info('Getting comment thread', {
      commentId: id,
      userId: uid,
    });

    const thread = await commentsService.getCommentThread(id, uid);

    if (!thread) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Comment not found',
        },
      });
    }

    res.json({
      ok: true,
      data: thread,
    });
  } catch (error) {
    logger.error('Failed to get comment thread', {
      error: error.message,
      commentId: req.params.id,
      userId: req.user?.uid,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get comment thread',
      },
    });
  }
}

/**
 * Get comment statistics
 * GET /api/v1/comments/:id/stats
 */
async function getCommentStats(req, res) {
  try {
    const { id } = req.params;

    logger.info('Getting comment stats', {
      commentId: id,
    });

    const stats = await commentsService.getCommentStats(id);

    res.json({
      ok: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get comment stats', {
      error: error.message,
      commentId: req.params.id,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Comment not found',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get comment stats',
      },
    });
  }
}

module.exports = {
  createComment,
  getComment,
  updateComment,
  deleteComment,
  voteOnComment,
  getPostComments,
  getCommentThread,
  getCommentStats,
};
