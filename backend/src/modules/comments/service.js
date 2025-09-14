const { db } = require('../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');
const { encodeCursor, decodeCursor } = require('../../lib/pagination');
const { caches } = require('../../lib/cache');
const votesService = require('../votes/service');
const postsService = require('../posts/service');


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
    // Note: do not use undefined variables in create path; caching is applied only in list operations.
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

    // Invalidate related caches
    caches.comments.clear();

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

    // Invalidate caches for comment lists for this post
    caches.comments.deleteByPrefix(`postComments:${comment.postId}:`);
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
 * Delete comment and all its replies (cascade delete)
 *
 * @param {string} commentId - Comment ID
 * @param {string} userId - User ID performing the delete
 * @returns {Object} Deletion result
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
    let canDelete = comment.authorId === userId; // Author can always delete their own comment
    
    // If comment belongs to a community, check community permissions
    if (comment.communityId) {
      const communityDoc = await db.collection('communities').doc(comment.communityId).get();
      if (!communityDoc.exists) {
        throw new Error('Community not found');
      }

      const community = communityDoc.data();
      canDelete = canDelete ||
        community.ownerId === userId ||
        (community.modIds && community.modIds.includes(userId));
    }

    if (!canDelete) {
      throw new Error('Insufficient permissions to delete this comment');
    }

    // Get all replies to this comment (cascade delete)
    const repliesQuery = db
      .collection('comments')
      .where('parentId', '==', commentId)
      .where('isDeleted', '==', false);

    const repliesSnapshot = await repliesQuery.get();
    const repliesToDelete = repliesSnapshot.docs.map(doc => doc.id);

    // Recursively delete all replies
    for (const replyId of repliesToDelete) {
      await deleteCommentRecursive(replyId, userId);
    }

    // Soft delete the main comment
    await commentRef.update({
      isDeleted: true,
      body: '[deleted]',
      updatedAt: new Date(),
    });

    // Update post comment count (main comment + all replies)
    const totalDeleted = 1 + repliesToDelete.length;
    await postsService.updateCommentCount(comment.postId, -totalDeleted);

    logger.info('Comment and replies deleted successfully', {
      commentId,
      deletedBy: userId,
      repliesDeleted: repliesToDelete.length,
      totalDeleted,
    });

    // Invalidate caches for comment lists for this post
    caches.comments.deleteByPrefix(`postComments:${comment.postId}:`);
    return { success: true, postId: comment.postId, repliesDeleted: repliesToDelete.length };
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
 * Recursively delete comment and all its replies
 * This is a helper function for cascade deletion
 *
 * @param {string} commentId - Comment ID
 * @param {string} userId - User ID performing the delete
 */
async function deleteCommentRecursive(commentId, userId) {
  try {
    const commentRef = db.collection('comments').doc(commentId);

    // Get all replies to this comment
    const repliesQuery = db
      .collection('comments')
      .where('parentId', '==', commentId)
      .where('isDeleted', '==', false);

    const repliesSnapshot = await repliesQuery.get();
    const repliesToDelete = repliesSnapshot.docs.map(doc => doc.id);

    // Recursively delete all replies first
    for (const replyId of repliesToDelete) {
      await deleteCommentRecursive(replyId, userId);
    }

    // Soft delete this comment
    await commentRef.update({
      isDeleted: true,
      body: '[deleted]',
      updatedAt: new Date(),
    });

    logger.info('Comment deleted recursively', {
      commentId,
      deletedBy: userId,
      repliesDeleted: repliesToDelete.length,
    });
  } catch (error) {
    logger.error('Failed to delete comment recursively', {
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

    // Generate cache key
    const cacheKey = `postComments:${postId}:${sort}:${pageSize}:${cursor || 'null'}`;

    // Check cache first
    const cached = caches.comments.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Check if post exists
    const postDoc = await db.collection('posts').doc(postId).get();
    if (!postDoc.exists) {
      throw new Error('Post not found');
    }

    // Build query - simplified to avoid index requirements
    let query = db
      .collection('comments')
      .where('postId', '==', postId);

    // For now, we'll fetch all comments and filter/sort in memory
    // This avoids the need for complex Firestore composite indexes
    // TODO: Add proper Firestore indexes for better performance

    const snapshot = await query.get();
    let comments = [];

    snapshot.forEach(doc => {
      const comment = {
        id: doc.id,
        ...doc.data(),
      };
      
      // Filter out deleted comments
      if (!comment.isDeleted) {
        comments.push(comment);
      }
    });

    // Sort in memory
    switch (sort) {
      case 'top':
        comments.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
      case 'new':
        comments.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
        break;
      case 'old':
        comments.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
        break;
      default:
        comments.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    }

    // Apply pagination in memory
    const startIndex = cursor ? parseInt(cursor) || 0 : 0;
    const endIndex = startIndex + pageSize;
    const paginatedComments = comments.slice(startIndex, endIndex);

    // Generate next cursor
    let nextCursor = null;
    if (endIndex < comments.length) {
      nextCursor = (startIndex + pageSize).toString();
    }

    const result = {
      comments: paginatedComments,
      pagination: {
        pageSize,
        hasMore: endIndex < comments.length,
        nextCursor,
      },
    };
    caches.comments.set(cacheKey, result);
    return result;
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
