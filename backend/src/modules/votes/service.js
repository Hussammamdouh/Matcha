const { db } = require('../../../lib/firebase');
const { calculateHotScore } = require('../../lib/ranking');
const { createModuleLogger } = require('../../lib/logger');


const logger = createModuleLogger();

/**
 * Shared votes service for posts and comments
 * Handles vote transactions and counter updates
 */

/**
 * Vote on a post
 *
 * @param {string} postId - Post ID
 * @param {string} userId - User ID
 * @param {number} value - Vote value: 1 (upvote), -1 (downvote), 0 (remove vote)
 * @returns {Object} Updated post data
 */
async function voteOnPost(postId, userId, value) {
  const postRef = db.collection('posts').doc(postId);
  const voteRef = postRef.collection('votes').doc(userId);

  try {
    const result = await db.runTransaction(async transaction => {
      // Get current post data
      const postDoc = await transaction.get(postRef);
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }

      const postData = postDoc.data();
      // Ensure numeric counters exist to avoid NaN operations
      const safePostData = {
        ...postData,
        upvotes: typeof postData.upvotes === 'number' ? postData.upvotes : 0,
        downvotes: typeof postData.downvotes === 'number' ? postData.downvotes : 0,
        score: typeof postData.score === 'number' ? postData.score : 0,
        createdAt: postData.createdAt,
      };

      // Get current user vote
      const voteDoc = await transaction.get(voteRef);
      const currentVote = voteDoc.exists ? voteDoc.data().value : 0;

      // Calculate vote changes
      let upvoteChange = 0;
      let downvoteChange = 0;
      let scoreChange = 0;

      if (value === 1 && currentVote !== 1) {
        // New upvote or change from downvote
        upvoteChange = 1;
        if (currentVote === -1) {
          downvoteChange = -1; // Remove previous downvote
        }
        scoreChange = upvoteChange + downvoteChange;
      } else if (value === -1 && currentVote !== -1) {
        // New downvote or change from upvote
        downvoteChange = 1;
        if (currentVote === 1) {
          upvoteChange = -1; // Remove previous upvote
        }
        scoreChange = upvoteChange + downvoteChange;
      } else if (value === 0 && currentVote !== 0) {
        // Remove vote
        if (currentVote === 1) {
          upvoteChange = -1;
        } else if (currentVote === -1) {
          downvoteChange = -1;
        }
        scoreChange = upvoteChange + downvoteChange;
      }

      // Update vote document
      if (value === 0) {
        // Remove vote
        transaction.delete(voteRef);
      } else {
        // Set or update vote
        transaction.set(voteRef, {
          value,
          uid: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Calculate new counters
      const newUpvotes = safePostData.upvotes + upvoteChange;
      const newDownvotes = safePostData.downvotes + downvoteChange;
      const newScore = newUpvotes - newDownvotes;
      // Compute hot score using a JS Date; Firestore Timestamp needs conversion
      const createdAtDate = safePostData.createdAt && typeof safePostData.createdAt.toDate === 'function'
        ? safePostData.createdAt.toDate()
        : (safePostData.createdAt instanceof Date ? safePostData.createdAt : new Date());
      const newHotScore = calculateHotScore(newUpvotes, newDownvotes, createdAtDate);

      // Update post document
      const updateData = {
        upvotes: newUpvotes,
        downvotes: newDownvotes,
        score: newScore,
        hotScore: newHotScore,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      };

      transaction.update(postRef, updateData);

      // Mirror like to top-level likes collection for querying
      const likesRef = db.collection('likes').doc(`${userId}_${postId}`);
      if (value === 1) {
        transaction.set(likesRef, { userId, postId, likedAt: new Date() });
      } else if (value === 0 && currentVote === 1) {
        transaction.delete(likesRef);
      }

      // Return updated post data
      return {
        ...safePostData,
        ...updateData,
        userVote: value === 0 ? null : value,
      };
    });

    logger.info('Post vote updated successfully', {
      postId,
      userId,
      value,
      previousVote: result.userVote,
    });

    return result;
  } catch (error) {
    logger.error('Failed to update post vote', {
      error: error.message,
      postId,
      userId,
      value,
    });
    throw error;
  }
}

/**
 * Vote on a comment
 *
 * @param {string} commentId - Comment ID
 * @param {string} userId - User ID
 * @param {number} value - Vote value: 1 (upvote), -1 (downvote), 0 (remove vote)
 * @returns {Object} Updated comment data
 */
async function voteOnComment(commentId, userId, value) {
  const commentRef = db.collection('comments').doc(commentId);
  const voteRef = commentRef.collection('votes').doc(userId);

  try {
    const result = await db.runTransaction(async transaction => {
      // Get current comment data
      const commentDoc = await transaction.get(commentRef);
      if (!commentDoc.exists) {
        throw new Error('Comment not found');
      }

      const commentData = commentDoc.data();
      const safeCommentData = {
        ...commentData,
        upvotes: typeof commentData.upvotes === 'number' ? commentData.upvotes : 0,
        downvotes: typeof commentData.downvotes === 'number' ? commentData.downvotes : 0,
        score: typeof commentData.score === 'number' ? commentData.score : 0,
      };

      // Get current user vote
      const voteDoc = await transaction.get(voteRef);
      const currentVote = voteDoc.exists ? voteDoc.data().value : 0;

      // Calculate vote changes
      let upvoteChange = 0;
      let downvoteChange = 0;
      let scoreChange = 0;

      if (value === 1 && currentVote !== 1) {
        // New upvote or change from downvote
        upvoteChange = 1;
        if (currentVote === -1) {
          downvoteChange = -1; // Remove previous downvote
        }
        scoreChange = upvoteChange + downvoteChange;
      } else if (value === -1 && currentVote !== -1) {
        // New downvote or change from upvote
        downvoteChange = 1;
        if (currentVote === 1) {
          upvoteChange = -1; // Remove previous upvote
        }
        scoreChange = upvoteChange + downvoteChange;
      } else if (value === 0 && currentVote !== 0) {
        // Remove vote
        if (currentVote === 1) {
          upvoteChange = -1;
        } else if (currentVote === -1) {
          downvoteChange = -1;
        }
        scoreChange = upvoteChange + downvoteChange;
      }

      // Update vote document
      if (value === 0) {
        // Remove vote
        transaction.delete(voteRef);
      } else {
        // Set or update vote
        transaction.set(voteRef, {
          value,
          uid: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Calculate new counters
      const newUpvotes = safeCommentData.upvotes + upvoteChange;
      const newDownvotes = safeCommentData.downvotes + downvoteChange;
      const newScore = newUpvotes - newDownvotes;

      // Update comment document
      const updateData = {
        upvotes: newUpvotes,
        downvotes: newDownvotes,
        score: newScore,
        updatedAt: new Date(),
      };

      transaction.update(commentRef, updateData);

      // Return updated comment data
      return {
        ...safeCommentData,
        ...updateData,
        userVote: value === 0 ? null : value,
        postId: commentData.postId,
      };
    });

    logger.info('Comment vote updated successfully', {
      commentId,
      userId,
      value,
      previousVote: result.userVote,
    });

    return result;
  } catch (error) {
    logger.error('Failed to update comment vote', {
      error: error.message,
      commentId,
      userId,
      value,
    });
    throw error;
  }
}

/**
 * Get user's vote on a post
 *
 * @param {string} postId - Post ID
 * @param {string} userId - User ID
 * @returns {number|null} Vote value or null if no vote
 */
async function getUserPostVote(postId, userId) {
  try {
    const voteDoc = await db.collection('posts').doc(postId).collection('votes').doc(userId).get();

    return voteDoc.exists ? voteDoc.data().value : null;
  } catch (error) {
    logger.error('Failed to get user post vote', {
      error: error.message,
      postId,
      userId,
    });
    return null;
  }
}

/**
 * Get user's vote on a comment
 *
 * @param {string} commentId - Comment ID
 * @param {string} userId - User ID
 * @returns {number|null} Vote value or null if no vote
 */
async function getUserCommentVote(commentId, userId) {
  try {
    const voteDoc = await db
      .collection('comments')
      .doc(commentId)
      .collection('votes')
      .doc(userId)
      .get();

    return voteDoc.exists ? voteDoc.data().value : null;
  } catch (error) {
    logger.error('Failed to get user comment vote', {
      error: error.message,
      commentId,
      userId,
    });
    return null;
  }
}

/**
 * Get vote statistics for a post
 *
 * @param {string} postId - Post ID
 * @returns {Object} Vote statistics
 */
async function getPostVoteStats(postId) {
  try {
    const postDoc = await db.collection('posts').doc(postId).get();

    if (!postDoc.exists) {
      throw new Error('Post not found');
    }

    const postData = postDoc.data();

    return {
      upvotes: postData.upvotes || 0,
      downvotes: postData.downvotes || 0,
      score: postData.score || 0,
      hotScore: postData.hotScore || 0,
    };
  } catch (error) {
    logger.error('Failed to get post vote stats', {
      error: error.message,
      postId,
    });
    throw error;
  }
}

/**
 * Get vote statistics for a comment
 *
 * @param {string} commentId - Comment ID
 * @returns {Object} Vote statistics
 */
async function getCommentVoteStats(commentId) {
  try {
    const commentDoc = await db.collection('comments').doc(commentId).get();

    if (!commentDoc.exists) {
      throw new Error('Comment not found');
    }

    const commentData = commentDoc.data();

    return {
      upvotes: commentData.upvotes || 0,
      downvotes: commentData.downvotes || 0,
      score: commentData.score || 0,
    };
  } catch (error) {
    logger.error('Failed to get comment vote stats', {
      error: error.message,
      commentId,
    });
    throw error;
  }
}

module.exports = {
  voteOnPost,
  voteOnComment,
  getUserPostVote,
  getUserCommentVote,
  getPostVoteStats,
  getCommentVoteStats,
};
