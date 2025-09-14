const { db } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');
const { computeHotScore } = require('../../lib/ranking');
const { caches } = require('../../lib/cache');
const { encodeCursor, decodeCursor } = require('../../lib/pagination');
const { validateMedia } = require('../../lib/storage');
const votesService = require('../votes/service');


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
    logger.info('=== POST SERVICE START ===', {
      userId,
      userNickname,
      postDataKeys: Object.keys(postData),
      communityId: postData.communityId,
      timestamp: new Date().toISOString()
    });

    // Check database connection
    logger.info('Checking database connection', { 
      hasDb: !!db,
      dbType: typeof db,
      dbMethods: Object.keys(db || {})
    });

    if (!db) {
      throw new Error('Database connection not available');
    }

    // If communityId is provided, validate and enforce membership rules; otherwise it's a public post
    let community = null;
    if (postData.communityId) {
      logger.info('Fetching community document', { 
        communityId: postData.communityId,
        collection: 'communities'
      });

      const communityDoc = await db.collection('communities').doc(postData.communityId).get();
      
      logger.info('Community document fetch result', {
        exists: communityDoc.exists,
        hasData: !!communityDoc.data(),
        communityId: postData.communityId
      });

      if (!communityDoc.exists) {
        logger.error('Community not found', { communityId: postData.communityId });
        throw new Error('Community not found');
      }

      community = communityDoc.data();
      logger.info('Community data retrieved', {
        communityKeys: Object.keys(community),
        isPrivate: community.isPrivate,
        postCount: community.postCount
      });

      // Check if community is private and user is member
      if (community.isPrivate) {
        logger.info('Checking private community membership', { 
          userId, 
          communityId: postData.communityId 
        });

        const membershipDoc = await db
          .collection('community_members')
          .where('userId', '==', userId)
          .where('communityId', '==', postData.communityId)
          .limit(1)
          .get();

        logger.info('Membership check result', {
          empty: membershipDoc.empty,
          size: membershipDoc.size,
          userId,
          communityId: postData.communityId
        });

        if (membershipDoc.empty) {
          logger.error('User not member of private community', { 
            userId, 
            communityId: postData.communityId 
          });
          throw new Error('Must be a member to post in private communities');
        }
      }
    }

    // Validate media if present
    if (postData.mediaDescriptors && postData.mediaDescriptors.length > 0) {
      logger.info('Validating media', { 
        mediaCount: postData.mediaDescriptors.length,
        mediaTypes: postData.mediaDescriptors.map(m => m.type)
      });

      for (const media of postData.mediaDescriptors) {
        const validation = validateMedia(media.mime, media.size, media.type);
        if (!validation.isValid) {
          logger.error('Media validation failed', { 
            media, 
            validationError: validation.error 
          });
          throw new Error(`Media validation failed: ${validation.error}`);
        }
      }
    }

    // Create post document
    logger.info('Creating post document', { 
      collection: 'posts',
      postData: {
        communityId: postData.communityId,
        authorId: userId,
        authorNickname: userNickname,
        title: postData.title,
        body: postData.body
      }
    });

    const postRef = db.collection('posts').doc();
    const post = {
      id: postRef.id,
      communityId: postData.communityId || null,
      authorId: userId,
      authorNickname: userNickname,
      title: postData.title,
      body: postData.body,
      media: postData.mediaDescriptors || [],
      tags: postData.tags || [],
      visibility: postData.visibility === 'community' && postData.communityId ? 'community' : 'public',
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

    logger.info('Post object created', { 
      postId: postRef.id,
      postKeys: Object.keys(post),
      postSize: JSON.stringify(post).length
    });

    logger.info('Saving post to database', { postId: postRef.id });
    await postRef.set(post);
    logger.info('Post saved successfully', { postId: postRef.id });

    // Update community post count if posted into a community
    if (postData.communityId && community) {
      logger.info('Updating community post count', { 
        communityId: postData.communityId,
        currentCount: community.postCount,
        newCount: community.postCount + 1
      });

      await db
        .collection('communities')
        .doc(postData.communityId)
        .update({
          postCount: community.postCount + 1,
          updatedAt: new Date(),
        });

      logger.info('Community post count updated successfully', { 
        communityId: postData.communityId 
      });
    }

    logger.info('=== POST SERVICE SUCCESS ===', {
      postId: postRef.id,
      communityId: postData.communityId,
      authorId: userId,
      timestamp: new Date().toISOString()
    });

    // Invalidate caches related to feeds
    caches.posts.clear();
    return post;
  } catch (error) {
    logger.error('=== POST SERVICE FAILED ===', {
      error: error.message,
      errorStack: error.stack,
      errorName: error.name,
      postData,
      userId,
      timestamp: new Date().toISOString()
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

    // Get community info if present
    if (post.communityId) {
      try {
        const communityDoc = await db.collection('communities').doc(post.communityId).get();
        if (communityDoc.exists) {
          post.community = {
            id: communityDoc.id,
            name: communityDoc.data().name,
            slug: communityDoc.data().slug,
            icon: communityDoc.data().icon,
          };
        }
      } catch (e) {
        logger.warn('Community fetch skipped for post', { postId, communityId: post.communityId, error: e.message });
      }
    }

    return post;
  } catch (error) {
    logger.error('Failed to get post', {
      error: error.message,
      stack: error.stack,
      postId,
      userId,
    });
    throw error;
  }
}

/**
 * List posts (public + by filters)
 * Supports optional filters: authorId, communityId, visibility, pageSize, cursor
 */
async function listPosts(filters = {}) {
  try {
    const { authorId, communityId, visibility, pageSize = 20, cursor = null } = filters;

    // Build a relaxed query to avoid composite index pitfalls
    let query = db.collection('posts');

    if (authorId) query = query.where('authorId', '==', authorId);
    if (communityId) query = query.where('communityId', '==', communityId);
    if (visibility) query = query.where('visibility', '==', visibility);

    // Fetch a bigger window, then sort/filter in-memory
    const snap = await query.limit(200).get();
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.isDeleted);

    // Sort new-first
    items.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });

    // Cursor pagination by id
    let startIndex = 0;
    if (cursor) {
      const decoded = decodeCursor(cursor);
      const cursorId = decoded?.id || decoded;
      const idx = items.findIndex(p => p.id === cursorId);
      startIndex = idx >= 0 ? idx + 1 : 0;
    }

    const page = items.slice(startIndex, startIndex + pageSize);
    const next = startIndex + pageSize < items.length ? encodeCursor({ id: page[page.length - 1].id }) : null;

    return {
      posts: page,
      pagination: {
        pageSize,
        hasMore: startIndex + pageSize < items.length,
        nextCursor: next,
      },
    };
  } catch (error) {
    logger.error('Failed to list posts', { error: error.message, filters });
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

    // Invalidate caches related to this community and home feed
    caches.posts.deleteByPrefix(`community:${post.communityId}:`);
    caches.posts.deleteByPrefix('home:');
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

    // Invalidate caches related to this community and home feed
    caches.posts.deleteByPrefix(`community:${post.communityId}:`);
    caches.posts.deleteByPrefix('home:');
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
    
    // Get user's joined communities and followed users
    const [membershipsQuery, followsQuery] = await Promise.all([
      db.collection('community_members').where('userId', '==', userId).get(),
      db.collection('follows').where('followerId', '==', userId).get(),
    ]);

    const communityIds = membershipsQuery.empty ? [] : membershipsQuery.docs.map(doc => doc.data().communityId);
    const followedUserIds = followsQuery.empty ? [] : followsQuery.docs.map(doc => doc.data().followedId);

    // Build query: posts from joined communities OR public posts from followed users
    let query = db.collection('posts').where('isDeleted', '==', false);

    // Firestore OR requires composite strategies; we'll do two queries and merge
    const queries = [];

    if (communityIds.length > 0) {
      let q = query.where('communityId', 'in', communityIds);
      queries.push(q);
    }

    if (followedUserIds.length > 0) {
      let q = query.where('authorId', 'in', followedUserIds).where('visibility', '==', 'public');
      queries.push(q);
    }

    if (queries.length === 0) {
      return { posts: [], pagination: { pageSize, hasMore: false, nextCursor: null } };
    }

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

    // Execute sub-queries
    const snapshots = await Promise.all(queries.map(q => q.get()));
    let posts = [];
    for (const snapshot of snapshots) {
      snapshot.forEach(doc => {
        posts.push({ id: doc.id, ...doc.data() });
      });
    }

    // De-dupe by id
    const seen = new Set();
    posts = posts.filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)));

    // Sort in-memory per sort param
    switch (sort) {
      case 'hot':
        posts.sort((a, b) => (b.hotScore || 0) - (a.hotScore || 0));
        break;
      case 'new':
        posts.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
        break;
      case 'top_24h':
      case 'top_7d':
      case 'top_all':
        posts.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
      default:
        posts.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    }

    // Pagination in-memory
    const startIndex = 0;
    const paged = posts.slice(startIndex, pageSize);

    // Generate next cursor
    let nextCursor = null;
    if (posts.length > pageSize) {
      const last = paged[paged.length - 1];
      nextCursor = encodeCursor({ id: last.id, createdAt: last.createdAt });
    }

    const result = {
      posts: paged,
      pagination: {
        pageSize,
        hasMore: posts.length > pageSize,
        nextCursor,
      },
    };
    caches.posts.set(cacheKey, result);
    return result;
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
    const cacheKey = `community:${communityId}:${sort}:${pageSize}:${cursor || 'start'}`;
    const cached = caches.posts.get(cacheKey);
    if (cached) return cached;
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
      const decoded = decodeCursor(cursor);
      if (decoded?.id) {
        try {
          const docSnap = await db.collection('posts').doc(decoded.id).get();
          if (docSnap.exists) {
            query = query.startAfter(docSnap);
          }
        } catch (_) {}
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
      nextCursor = encodeCursor({ id: lastDoc.id, createdAt: lastDoc.get('createdAt') });
    }

    const result = {
      posts,
      pagination: {
        pageSize,
        hasMore: posts.length === pageSize,
        nextCursor,
      },
    };
    caches.posts.set(cacheKey, result);
    return result;
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

    // Fetch all saves for user (bounded), then sort and paginate in-memory to avoid composite index
    const allSavesSnap = await db.collection('saves').where('userId', '==', userId).get();

    let saves = allSavesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    saves.sort((a, b) => {
      const ta = a.savedAt?.toMillis ? a.savedAt.toMillis() : new Date(a.savedAt || 0).getTime();
      const tb = b.savedAt?.toMillis ? b.savedAt.toMillis() : new Date(b.savedAt || 0).getTime();
      return tb - ta;
    });

    let startIndex = 0;
    if (cursor) {
      const decoded = decodeCursor(cursor);
      const cursorId = decoded?.id || decoded; // support plain id
      const idx = saves.findIndex(s => s.id === cursorId);
      startIndex = idx >= 0 ? idx + 1 : 0;
    }

    const page = saves.slice(startIndex, startIndex + pageSize);

    // Hydrate posts
    const posts = [];
    for (const s of page) {
      const postDoc = await db.collection('posts').doc(s.postId).get();
      if (postDoc.exists && !postDoc.data().isDeleted) {
        posts.push({ id: postDoc.id, ...postDoc.data(), savedAt: s.savedAt });
      }
    }

    const last = startIndex + pageSize < saves.length ? page[page.length - 1] : null;
    const nextCursor = last ? encodeCursor({ id: last.id }) : null;

    return {
      posts,
      pagination: {
        pageSize,
        hasMore: startIndex + pageSize < saves.length,
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
  listPosts,
  updatePost,
  deletePost,
  getHomeFeed,
  getCommunityPosts,
  togglePostSave,
  getSavedPosts,
  updateCommentCount,
};
