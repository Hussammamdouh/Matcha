const { getFirestore } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');
const { computeHotScore, generateCursor, parseCursor } = require('../../lib/ranking');
const { validateMedia } = require('../../lib/storage');
const votesService = require('../votes/service');

const db = getFirestore();
const logger = createModuleLogger();

/**
 * Posts service for Matcha
 * Handles all Firestore operations for posts and feed generation
 */

/**
 * Create a new post
 *
 * @param {Object} postData - Post data
 * @param {string} userId - User ID creating the post
 * @param {string} userNickname - User's nickname
 * @returns {Object} Created post
 */
async function createPost(postData, userId, userNickname) {
  try {
    // Validate community exists and user is member
    const communityDoc = await db.collection('communities').doc(postData.communityId).get();
    if (!communityDoc.exists) {
      throw new Error('Community not found');
    }

    const community = communityDoc.data();

    // Check if community is private and user is member
    if (community.isPrivate) {
      const membershipDoc = await db
        .collection('community_members')
        .where('userId', '==', userId)
        .where('communityId', '==', postData.communityId)
        .limit(1)
        .get();

      if (membershipDoc.empty) {
        throw new Error('Must be a member to post in private communities');
      }
    }

    // Validate media if present
    if (postData.mediaDescriptors && postData.mediaDescriptors.length > 0) {
      for (const media of postData.mediaDescriptors) {
        const validation = validateMedia(media.mime, media.size, media.type);
        if (!validation.isValid) {
          throw new Error(`Media validation failed: ${validation.error}`);
        }
      }
    }

    // Create post document
    const postRef = db.collection('posts').doc();
    const post = {
      id: postRef.id,
      communityId: postData.communityId,
      authorId: userId,
      authorNickname: userNickname,
      title: postData.title,
      body: postData.body,
      media: postData.mediaDescriptors || [],
      tags: postData.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      edited: false,
      isDeleted: false,
      upvotes: 0,
      downvotes: 0,
      score: 0,
      hotScore: 0,
      commentCount: 0,
      lastActivityAt: new Date(),
    };

    await postRef.set(post);

    // Update community post count
    await db
      .collection('communities')
      .doc(postData.communityId)
      .update({
        postCount: community.postCount + 1,
        updatedAt: new Date(),
      });

    logger.info('Post created successfully', {
      postId: postRef.id,
      communityId: postData.communityId,
      authorId: userId,
    });

    return post;
  } catch (error) {
    logger.error('Failed to create post', {
      error: error.message,
      postData,
      userId,
    });
    throw error;
  }
}

/**
 * Get post by ID
 *
 * @param {string} postId - Post ID
 * @param {string} userId - Optional user ID for vote info
 * @returns {Object|null} Post data or null if not found
 */
async function getPost(postId, userId = null) {
  try {
    const postDoc = await db.collection('posts').doc(postId).get();

    if (!postDoc.exists) {
      return null;
    }

    const post = { id: postDoc.id, ...postDoc.data() };

    // Get user's vote if userId provided
    if (userId) {
      post.userVote = await votesService.getUserPostVote(postId, userId);
    }

    // Get community info
    const communityDoc = await db.collection('communities').doc(post.communityId).get();
    if (communityDoc.exists) {
      post.community = {
        id: communityDoc.id,
        name: communityDoc.data().name,
        slug: communityDoc.data().slug,
        icon: communityDoc.data().icon,
      };
    }

    return post;
  } catch (error) {
    logger.error('Failed to get post', {
      error: error.message,
      postId,
      userId,
    });
    throw error;
  }
}

/**
 * Update post
 *
 * @param {string} postId - Post ID
 * @param {Object} updateData - Data to update
 * @param {string} userId - User ID performing the update
 * @returns {Object} Updated post
 */
async function updatePost(postId, updateData, userId) {
  try {
    const postRef = db.collection('posts').doc(postId);

    // Check if post exists and user has permission
    const postDoc = await postRef.get();
    if (!postDoc.exists) {
      throw new Error('Post not found');
    }

    const post = postDoc.data();
    if (post.authorId !== userId) {
      throw new Error('Only the author can edit this post');
    }

    if (post.isDeleted) {
      throw new Error('Cannot edit deleted post');
    }

    // Update post
    const updatePayload = {
      ...updateData,
      edited: true,
      updatedAt: new Date(),
    };

    await postRef.update(updatePayload);

    logger.info('Post updated successfully', {
      postId,
      updatedBy: userId,
      updatedFields: Object.keys(updateData),
    });

    return { id: postId, ...post, ...updatePayload };
  } catch (error) {
    logger.error('Failed to update post', {
      error: error.message,
      postId,
      updateData,
      userId,
    });
    throw error;
  }
}

/**
 * Soft delete post
 *
 * @param {string} postId - Post ID
 * @param {string} userId - User ID performing the delete
 * @returns {boolean} Success status
 */
async function deletePost(postId, userId) {
  try {
    const postRef = db.collection('posts').doc(postId);

    // Check if post exists and user has permission
    const postDoc = await postRef.get();
    if (!postDoc.exists) {
      throw new Error('Post not found');
    }

    const post = postDoc.data();

    // Check permissions (author or community mod/owner)
    const communityDoc = await db.collection('communities').doc(post.communityId).get();
    if (!communityDoc.exists) {
      throw new Error('Community not found');
    }

    const community = communityDoc.data();
    const canDelete =
      post.authorId === userId || community.ownerId === userId || community.modIds.includes(userId);

    if (!canDelete) {
      throw new Error('Insufficient permissions to delete this post');
    }

    // Soft delete
    await postRef.update({
      isDeleted: true,
      body: '[deleted]',
      updatedAt: new Date(),
    });

    logger.info('Post deleted successfully', {
      postId,
      deletedBy: userId,
    });

    return true;
  } catch (error) {
    logger.error('Failed to delete post', {
      error: error.message,
      postId,
      userId,
    });
    throw error;
  }
}

/**
 * Get home feed (posts from joined communities)
 *
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} Paginated posts list
 */
async function getHomeFeed(userId, options = {}) {
  try {
    const { sort = 'hot', pageSize = 20, cursor = null } = options;

    // Get user's joined communities
    const membershipsQuery = await db
      .collection('community_members')
      .where('userId', '==', userId)
      .get();

    if (membershipsQuery.empty) {
      return { posts: [], pagination: { pageSize, hasMore: false, nextCursor: null } };
    }

    const communityIds = membershipsQuery.docs.map(doc => doc.data().communityId);

    // Build query based on sort
    let query = db
      .collection('posts')
      .where('communityId', 'in', communityIds)
      .where('isDeleted', '==', false);

    switch (sort) {
      case 'hot':
        query = query.orderBy('hotScore', 'desc');
        break;
      case 'new':
        query = query.orderBy('createdAt', 'desc');
        break;
      case 'top_24h': {
        // Note: This requires a composite index on (createdAt ASC, score DESC)
        // For now, we'll order by score and filter in memory
        query = query.orderBy('score', 'desc');
        break;
      }
      case 'top_7d': {
        // Note: This requires a composite index on (createdAt ASC, score DESC)
        // For now, we'll order by score and filter in memory
        query = query.orderBy('score', 'desc');
        break;
      }
      case 'top_all':
        query = query.orderBy('score', 'desc');
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
    const posts = [];

    snapshot.forEach(doc => {
      posts.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Generate next cursor
    let nextCursor = null;
    if (posts.length === pageSize) {
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      nextCursor = generateCursor(lastDoc.data(), sort);
    }

    return {
      posts,
      pagination: {
        pageSize,
        hasMore: posts.length === pageSize,
        nextCursor,
      },
    };
  } catch (error) {
    logger.error('Failed to get home feed', {
      error: error.message,
      userId,
      options,
    });
    throw error;
  }
}

/**
 * Get community posts
 *
 * @param {string} communityId - Community ID
 * @param {Object} options - Query options
 * @returns {Object} Paginated posts list
 */
async function getCommunityPosts(communityId, options = {}) {
  try {
    const { sort = 'hot', pageSize = 20, cursor = null } = options;

    // Check if community exists
    const communityDoc = await db.collection('communities').doc(communityId).get();
    if (!communityDoc.exists) {
      throw new Error('Community not found');
    }

    // Build query
    let query = db
      .collection('posts')
      .where('communityId', '==', communityId)
      .where('isDeleted', '==', false);

    switch (sort) {
      case 'hot':
        query = query.orderBy('hotScore', 'desc');
        break;
      case 'new':
        query = query.orderBy('createdAt', 'desc');
        break;
      case 'top_24h': {
        // Note: This requires a composite index on (createdAt ASC, score DESC)
        // For now, we'll order by score and filter in memory
        query = query.orderBy('score', 'desc');
        break;
      }
      case 'top_7d': {
        // Note: This requires a composite index on (createdAt ASC, score DESC)
        // For now, we'll order by score and filter in memory
        break;
      }
      case 'top_all':
        query = query.orderBy('score', 'desc');
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
    const posts = [];

    snapshot.forEach(doc => {
      posts.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Generate next cursor
    let nextCursor = null;
    if (posts.length === pageSize) {
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      nextCursor = generateCursor(lastDoc.data(), sort);
    }

    return {
      posts,
      pagination: {
        pageSize,
        hasMore: posts.length === pageSize,
        nextCursor,
      },
    };
  } catch (error) {
    logger.error('Failed to get community posts', {
      error: error.message,
      communityId,
      options,
    });
    throw error;
  }
}

/**
 * Save/unsave post for user
 *
 * @param {string} postId - Post ID
 * @param {string} userId - User ID
 * @param {boolean} save - True to save, false to unsave
 * @returns {Object} Save operation result
 */
async function togglePostSave(postId, userId, save) {
  try {
    // Check if post exists
    const postDoc = await db.collection('posts').doc(postId).get();
    if (!postDoc.exists) {
      throw new Error('Post not found');
    }

    const saveRef = db.collection('saves').doc(`${userId}_${postId}`);

    if (save) {
      // Save post
      await saveRef.set({
        userId,
        postId,
        savedAt: new Date(),
      });

      logger.info('Post saved', { postId, userId });
      return { saved: true };
    } else {
      // Unsave post
      await saveRef.delete();

      logger.info('Post unsaved', { postId, userId });
      return { saved: false };
    }
  } catch (error) {
    logger.error('Failed to toggle post save', {
      error: error.message,
      postId,
      userId,
      save,
    });
    throw error;
  }
}

/**
 * Get user's saved posts
 *
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} Paginated saved posts list
 */
async function getSavedPosts(userId, options = {}) {
  try {
    const { pageSize = 20, cursor = null } = options;

    // Get saved posts
    let query = db.collection('saves').where('userId', '==', userId);
    
    // Note: This requires a composite index on (userId ASC, savedAt DESC)
    // For now, we'll order by savedAt and filter by userId in memory
    query = query.orderBy('savedAt', 'desc');

    // Apply pagination
    if (cursor) {
      const parsedCursor = parseCursor(cursor);
      if (parsedCursor) {
        // TODO: Implement cursor-based pagination
      }
    }

    query = query.limit(pageSize);

    const snapshot = await query.get();
    const savedPosts = [];

    // Get post details for each saved post
    for (const saveDoc of snapshot.docs) {
      const saveData = saveDoc.data();
      const postDoc = await db.collection('posts').doc(saveData.postId).get();

      if (postDoc.exists && !postDoc.data().isDeleted) {
        const post = postDoc.data();
        savedPosts.push({
          id: postDoc.id,
          ...post,
          savedAt: saveData.savedAt,
        });
      }
    }

    // Generate next cursor
    let nextCursor = null;
    if (savedPosts.length === pageSize) {
      const lastSave = snapshot.docs[snapshot.docs.length - 1];
      nextCursor = generateCursor(lastSave.data(), 'saved');
    }

    return {
      posts: savedPosts,
      pagination: {
        pageSize,
        hasMore: savedPosts.length === pageSize,
        nextCursor,
      },
    };
  } catch (error) {
    logger.error('Failed to get saved posts', {
      error: error.message,
      userId,
      options,
    });
    throw error;
  }
}

/**
 * Update post comment count
 *
 * @param {string} postId - Post ID
 * @param {number} change - Change in comment count (+1 or -1)
 * @returns {boolean} Success status
 */
async function updateCommentCount(postId, change) {
  try {
    const postRef = db.collection('posts').doc(postId);

    await postRef.update({
      commentCount: db.FieldValue.increment(change),
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    });

    return true;
  } catch (error) {
    logger.error('Failed to update post comment count', {
      error: error.message,
      postId,
      change,
    });
    return false;
  }
}

module.exports = {
  createPost,
  getPost,
  updatePost,
  deletePost,
  getHomeFeed,
  getCommunityPosts,
  togglePostSave,
  getSavedPosts,
  updateCommentCount,
};
