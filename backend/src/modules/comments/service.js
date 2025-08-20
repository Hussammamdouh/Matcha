const { getFirestore } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');
const { generateCursor, parseCursor } = require('../../lib/ranking');
const votesService = require('../votes/service');
const postsService = require('../posts/service');

const db = getFirestore();
const logger = createModuleLogger();

/**
 * Comments service for Matcha
 * Handles all Firestore operations for comments including threading
 */

/**
 * Create a new comment
 *
 * @param {Object} commentData - Comment data
 * @param {string} postId - Post ID
 * @param {string} userId - User ID creating the comment
 * @param {string} userNickname - User's nickname
 * @returns {Object} Created comment
 */
async function createComment(commentData, postId, userId, userNickname) {
  try {
    // Check if post exists
    const postDoc = await db.collection('posts').doc(postId).get();
    if (!postDoc.exists) {
      throw new Error('Post not found');
    }

    const post = postDoc.data();

    // Check if post is deleted
    if (post.isDeleted) {
      throw new Error('Cannot comment on deleted post');
    }

    // Validate comment depth if parent comment exists
    let depth = 0;
    if (commentData.parentId) {
      const parentCommentDoc = await db.collection('comments').doc(commentData.parentId).get();
      if (!parentCommentDoc.exists) {
        throw new Error('Parent comment not found');
      }

      const parentComment = parentCommentDoc.data();
      depth = parentComment.depth + 1;

      // Enforce maximum depth of 3
      if (depth > 3) {
        throw new Error('Comment depth cannot exceed 3 levels');
      }
    }

    // Create comment document
    const commentRef = db.collection('comments').doc();
    const comment = {
      id: commentRef.id,
      postId,
      communityId: post.communityId,
      authorId: userId,
      authorNickname: userNickname,
      body: commentData.body,
      parentId: commentData.parentId || null,
      depth,
      createdAt: new Date(),
      updatedAt: new Date(),
      edited: false,
      isDeleted: false,
      upvotes: 0,
      downvotes: 0,
      score: 0,
    };

    await commentRef.set(comment);

    // Update post comment count
    await postsService.updateCommentCount(postId, 1);

    logger.info('Comment created successfully', {
      commentId: commentRef.id,
      postId,
      authorId: userId,
      depth,
    });

    return comment;
  } catch (error) {
    logger.error('Failed to create comment', {
      error: error.message,
      commentData,
      postId,
      userId,
    });
    throw error;
  }
}

/**
 * Get comment by ID
 *
 * @param {string} commentId - Comment ID
 * @param {string} userId - Optional user ID for vote info
 * @returns {Object|null} Comment data or null if not found
 */
async function getComment(commentId, userId = null) {
  try {
    const commentDoc = await db.collection('comments').doc(commentId).get();

    if (!commentDoc.exists) {
      return null;
    }

    const comment = { id: commentDoc.id, ...commentDoc.data() };

    // Get user's vote if userId provided
    if (userId) {
      comment.userVote = await votesService.getUserCommentVote(commentId, userId);
    }

    return comment;
  } catch (error) {
    logger.error('Failed to get comment', {
      error: error.message,
      commentId,
      userId,
    });
    throw error;
  }
}

/**
 * Update comment
 *
 * @param {string} commentId - Comment ID
 * @param {Object} updateData - Data to update
 * @param {string} userId - User ID performing the update
 * @returns {Object} Updated comment
 */
async function updateComment(commentId, updateData, userId) {
  try {
    const commentRef = db.collection('comments').doc(commentId);

    // Check if comment exists and user has permission
    const commentDoc = await commentRef.get();
    if (!commentDoc.exists) {
      throw new Error('Comment not found');
    }

    const comment = commentDoc.data();
    if (comment.authorId !== userId) {
      throw new Error('Only the author can edit this comment');
    }

    if (comment.isDeleted) {
      throw new Error('Cannot edit deleted comment');
    }

    // Update comment
    const updatePayload = {
      ...updateData,
      edited: true,
      updatedAt: new Date(),
    };

    await commentRef.update(updatePayload);

    logger.info('Comment updated successfully', {
      commentId,
      updatedBy: userId,
      updatedFields: Object.keys(updateData),
    });

    return { id: commentId, ...comment, ...updatePayload };
  } catch (error) {
    logger.error('Failed to update comment', {
      error: error.message,
      commentId,
      updateData,
      userId,
    });
    throw error;
  }
}

/**
 * Soft delete comment
 *
 * @param {string} commentId - Comment ID
 * @param {string} userId - User ID performing the delete
 * @returns {boolean} Success status
 */
async function deleteComment(commentId, userId) {
  try {
    const commentRef = db.collection('comments').doc(commentId);

    // Check if comment exists and user has permission
    const commentDoc = await commentRef.get();
    if (!commentDoc.exists) {
      throw new Error('Comment not found');
    }

    const comment = commentDoc.data();

    // Check permissions (author or community mod/owner)
    const communityDoc = await db.collection('communities').doc(comment.communityId).get();
    if (!communityDoc.exists) {
      throw new Error('Community not found');
    }

    const community = communityDoc.data();
    const canDelete =
      comment.authorId === userId ||
      community.ownerId === userId ||
      community.modIds.includes(userId);

    if (!canDelete) {
      throw new Error('Insufficient permissions to delete this comment');
    }

    // Soft delete
    await commentRef.update({
      isDeleted: true,
      body: '[deleted]',
      updatedAt: new Date(),
    });

    // Update post comment count
    await postsService.updateCommentCount(comment.postId, -1);

    logger.info('Comment deleted successfully', {
      commentId,
      deletedBy: userId,
    });

    return true;
  } catch (error) {
    logger.error('Failed to delete comment', {
      error: error.message,
      commentId,
      userId,
    });
    throw error;
  }
}

/**
 * Get comments for a post
 *
 * @param {string} postId - Post ID
 * @param {Object} options - Query options
 * @returns {Object} Paginated comments list
 */
async function getPostComments(postId, options = {}) {
  try {
    const { sort = 'top', pageSize = 20, cursor = null } = options;

    // Check if post exists
    const postDoc = await db.collection('posts').doc(postId).get();
    if (!postDoc.exists) {
      throw new Error('Post not found');
    }

    // Build query
    let query = db
      .collection('comments')
      .where('postId', '==', postId)
      .where('isDeleted', '==', false);

    switch (sort) {
      case 'top':
        query = query.orderBy('score', 'desc');
        break;
      case 'new':
        query = query.orderBy('createdAt', 'desc');
        break;
      case 'old':
        query = query.orderBy('createdAt', 'asc');
        break;
      default:
        query = query.orderBy('createdAt', 'desc');
    }

    // Apply pagination
    if (cursor) {
      const parsedCursor = parseCursor(cursor);
      if (parsedCursor && parsedCursor.sortBy === sort) {
        // TODO: Implement cursor-based pagination
      }
    }

    query = query.limit(pageSize);

    const snapshot = await query.get();
    const comments = [];

    snapshot.forEach(doc => {
      comments.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Generate next cursor
    let nextCursor = null;
    if (comments.length === pageSize) {
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      nextCursor = generateCursor(lastDoc.data(), sort);
    }

    return {
      comments,
      pagination: {
        pageSize,
        hasMore: comments.length === pageSize,
        nextCursor,
      },
    };
  } catch (error) {
    logger.error('Failed to get post comments', {
      error: error.message,
      postId,
      options,
    });
    throw error;
  }
}

/**
 * Get comment thread (comment + all replies)
 *
 * @param {string} commentId - Comment ID
 * @param {string} userId - Optional user ID for vote info
 * @returns {Object|null} Comment thread or null if not found
 */
async function getCommentThread(commentId, userId = null) {
  try {
    // Get the main comment
    const comment = await getComment(commentId, userId);
    if (!comment) {
      return null;
    }

    // Get all replies recursively
    const replies = await getCommentReplies(commentId, userId);

    return {
      ...comment,
      replies,
    };
  } catch (error) {
    logger.error('Failed to get comment thread', {
      error: error.message,
      commentId,
      userId,
    });
    throw error;
  }
}

/**
 * Get comment replies recursively
 *
 * @param {string} commentId - Comment ID
 * @param {string} userId - Optional user ID for vote info
 * @returns {Array} Array of replies
 */
async function getCommentReplies(commentId, userId = null) {
  try {
    const repliesQuery = await db
      .collection('comments')
      .where('parentId', '==', commentId)
      .where('isDeleted', '==', false)
      .orderBy('score', 'desc')
      .orderBy('createdAt', 'asc')
      .get();

    const replies = [];

    for (const replyDoc of repliesQuery.docs) {
      const reply = { id: replyDoc.id, ...replyDoc.data() };

      // Get user's vote if userId provided
      if (userId) {
        reply.userVote = await votesService.getUserCommentVote(reply.id, userId);
      }

      // Get nested replies
      const nestedReplies = await getCommentReplies(reply.id, userId);
      if (nestedReplies.length > 0) {
        reply.replies = nestedReplies;
      }

      replies.push(reply);
    }

    return replies;
  } catch (error) {
    logger.error('Failed to get comment replies', {
      error: error.message,
      commentId,
      userId,
    });
    return [];
  }
}

/**
 * Get comment statistics
 *
 * @param {string} commentId - Comment ID
 * @returns {Object} Comment statistics
 */
async function getCommentStats(commentId) {
  try {
    const commentDoc = await db.collection('comments').doc(commentId).get();

    if (!commentDoc.exists) {
      throw new Error('Comment not found');
    }

    const comment = commentDoc.data();

    // Count replies
    const repliesQuery = await db
      .collection('comments')
      .where('parentId', '==', commentId)
      .where('isDeleted', '==', false)
      .get();

    return {
      upvotes: comment.upvotes || 0,
      downvotes: comment.downvotes || 0,
      score: comment.score || 0,
      replyCount: repliesQuery.size,
    };
  } catch (error) {
    logger.error('Failed to get comment stats', {
      error: error.message,
      commentId,
    });
    throw error;
  }
}

module.exports = {
  createComment,
  getComment,
  updateComment,
  deleteComment,
  getPostComments,
  getCommentThread,
  getCommentReplies,
  getCommentStats,
};
