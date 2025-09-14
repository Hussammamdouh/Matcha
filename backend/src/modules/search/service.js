const { getFirestore } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');
const { encodeCursor, decodeCursor } = require('../../lib/pagination');
const { caches } = require('../../lib/cache');

const db = getFirestore();
const logger = createModuleLogger();

/**
 * Global search across posts, communities, and users
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {string} options.type - Content type filter (posts, communities, users, all)
 * @param {string} options.category - Community category filter
 * @param {string} options.sortBy - Sort field (relevance, score, createdAt)
 * @param {string} options.cursor - Pagination cursor
 * @param {number} options.limit - Results limit
 * @returns {Object} Search results with pagination
 */
async function globalSearch(query, options = {}) {
  const {
    type = 'all',
    category = null,
    sortBy = 'relevance',
    cursor = null,
    limit = 20,
  } = options;

  try {
    const results = {
      posts: [],
      communities: [],
      users: [],
      meta: {
        query,
        type,
        category,
        sortBy,
        totalResults: 0,
        nextCursor: null,
      },
    };

    // Parse cursor for pagination
    const cursorData = cursor ? decodeCursor(cursor) : null;

    if (type === 'all' || type === 'posts') {
      const postsQuery = await searchPosts(query, { category, sortBy, cursor: cursorData, limit });
      results.posts = postsQuery.results;
      results.meta.totalResults += postsQuery.total;
      results.meta.nextCursor = postsQuery.nextCursor;
    }

    if (type === 'all' || type === 'communities') {
      const communitiesQuery = await searchCommunities(query, {
        category,
        sortBy,
        cursor: cursorData,
        limit,
      });
      results.communities = communitiesQuery.results;
      results.meta.totalResults += communitiesQuery.total;
      // Use the last cursor for pagination
      if (communitiesQuery.nextCursor) {
        results.meta.nextCursor = communitiesQuery.nextCursor;
      }
    }

    if (type === 'all' || type === 'users') {
      const usersQuery = await searchUsers(query, { sortBy, cursor: cursorData, limit });
      results.users = usersQuery.results;
      results.meta.totalResults += usersQuery.total;
      // Use the last cursor for pagination
      if (usersQuery.nextCursor) {
        results.meta.nextCursor = usersQuery.nextCursor;
      }
    }

    logger.info('Global search completed', {
      query,
      type,
      totalResults: results.meta.totalResults,
      hasNextCursor: !!results.meta.nextCursor,
    });

    // Light caching only for empty search query without cursor
    if (!query && !cursor) {
      const cacheKey = `search:${type}:${category || 'all'}:${sortBy}:${limit}`;
      caches.search.set(cacheKey, results, 20_000);
    }
    return results;
  } catch (error) {
    logger.error('Global search failed', { error: error.message, query });
    throw error;
  }
}

/**
 * Search posts by query
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Object} Search results
 */
async function searchPosts(query, options = {}) {
  const { category, sortBy, cursor, limit } = options;

  try {
    let postsRef = db.collection('posts').where('isDeleted', '==', false);

    // Apply category filter if specified
    if (category) {
      postsRef = postsRef.where('communityId', 'in', await getCommunityIdsByCategory(category));
    }

    // Apply sorting
    switch (sortBy) {
      case 'score':
        postsRef = postsRef.orderBy('score', 'desc');
        break;
      case 'createdAt':
        postsRef = postsRef.orderBy('createdAt', 'desc');
        break;
      case 'relevance':
      default:
        postsRef = postsRef.orderBy('hotScore', 'desc');
        break;
    }

    // Apply cursor pagination
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded?.id) {
        try {
          const docSnap = await db.collection('posts').doc(decoded.id).get();
          if (docSnap.exists) {
            postsRef = postsRef.startAfter(docSnap);
          }
        } catch (_) {}
      }
    }

    const snapshot = await postsRef.limit(limit).get();
    const posts = [];

    snapshot.forEach(doc => {
      const post = doc.data();
      if (matchesQuery(post, query)) {
        posts.push({
          id: doc.id,
          ...post,
        });
      }
    });

    // Generate next cursor
    const nextCursor =
      snapshot.docs.length === limit
        ? encodeCursor({ id: snapshot.docs[snapshot.docs.length - 1].id, createdAt: snapshot.docs[snapshot.docs.length - 1].get('createdAt') })
        : null;

    return {
      results: posts,
      total: posts.length,
      nextCursor,
    };
  } catch (error) {
    logger.error('Post search failed', { error: error.message, query });
    throw error;
  }
}

/**
 * Search communities by query
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Object} Search results
 */
async function searchCommunities(query, options = {}) {
  const { category, sortBy, cursor, limit } = options;

  try {
    let communitiesRef = db.collection('communities').where('isDeleted', '==', false);

    // Apply category filter if specified
    if (category) {
      communitiesRef = communitiesRef.where('category', '==', category);
    }

    // Apply sorting
    switch (sortBy) {
      case 'memberCount':
        communitiesRef = communitiesRef.orderBy('memberCount', 'desc');
        break;
      case 'createdAt':
        communitiesRef = communitiesRef.orderBy('createdAt', 'desc');
        break;
      case 'relevance':
      default:
        communitiesRef = communitiesRef.orderBy('score', 'desc');
        break;
    }

    // Apply cursor pagination
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded?.id) {
        try {
          const docSnap = await db.collection('communities').doc(decoded.id).get();
          if (docSnap.exists) {
            communitiesRef = communitiesRef.startAfter(docSnap);
          }
        } catch (_) {}
      }
    }

    const snapshot = await communitiesRef.limit(limit).get();
    const communities = [];

    snapshot.forEach(doc => {
      const community = doc.data();
      if (matchesQuery(community, query)) {
        communities.push({
          id: doc.id,
          ...community,
        });
      }
    });

    // Generate next cursor
    const nextCursor =
      snapshot.docs.length === limit
        ? encodeCursor({ id: snapshot.docs[snapshot.docs.length - 1].id, createdAt: snapshot.docs[snapshot.docs.length - 1].get('createdAt') })
        : null;

    return {
      results: communities,
      total: communities.length,
      nextCursor,
    };
  } catch (error) {
    logger.error('Community search failed', { error: error.message, query });
    throw error;
  }
}

/**
 * Search users by query
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Object} Search results
 */
async function searchUsers(query, options = {}) {
  const { sortBy, cursor, limit } = options;

  try {
    let usersRef = db.collection('users').where('isDeleted', '==', false);

    // Apply sorting
    switch (sortBy) {
      case 'createdAt':
        usersRef = usersRef.orderBy('createdAt', 'desc');
        break;
      case 'relevance':
      default:
        usersRef = usersRef.orderBy('score', 'desc');
        break;
    }

    // Apply cursor pagination
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded?.id) {
        try {
          const docSnap = await db.collection('users').doc(decoded.id).get();
          if (docSnap.exists) {
            usersRef = usersRef.startAfter(docSnap);
          }
        } catch (_) {}
      }
    }

    const snapshot = await usersRef.limit(limit).get();
    const users = [];

    snapshot.forEach(doc => {
      const user = doc.data();
      if (matchesQuery(user, query)) {
        users.push({
          id: doc.id,
          nickname: user.nickname,
          avatar: user.avatar,
          score: user.score,
          createdAt: user.createdAt,
        });
      }
    });

    // Generate next cursor
    const nextCursor =
      snapshot.docs.length === limit
        ? encodeCursor({ id: snapshot.docs[snapshot.docs.length - 1].id, createdAt: snapshot.docs[snapshot.docs.length - 1].get('createdAt') })
        : null;

    return {
      results: users,
      total: users.length,
      nextCursor,
    };
  } catch (error) {
    logger.error('User search failed', { error: error.message, query });
    throw error;
  }
}

/**
 * Get trending posts (most popular in last 24 hours)
 * @param {Object} options - Options
 * @param {string} options.category - Community category filter
 * @param {string} options.cursor - Pagination cursor
 * @param {number} options.limit - Results limit
 * @returns {Object} Trending posts
 */
async function getTrendingPosts(options = {}) {
  const { category, cursor, limit = 20 } = options;

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let postsRef = db
      .collection('posts')
      .where('isDeleted', '==', false)
      .where('createdAt', '>=', oneDayAgo);

    // Apply category filter if specified
    if (category) {
      postsRef = postsRef.where('communityId', 'in', await getCommunityIdsByCategory(category));
    }

    postsRef = postsRef.orderBy('hotScore', 'desc');

    // Apply cursor pagination
    if (cursor) {
      // TODO: Implement cursor-based pagination for trending posts
    }

    const snapshot = await postsRef.limit(limit).get();
    const posts = [];

    snapshot.forEach(doc => {
      posts.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Generate next cursor
    const nextCursor =
      snapshot.docs.length === limit
        ? generateCursor(snapshot.docs[snapshot.docs.length - 1])
        : null;

    return {
      results: posts,
      total: posts.length,
      nextCursor,
    };
  } catch (error) {
    logger.error('Trending posts search failed', { error: error.message });
    throw error;
  }
}

/**
 * Get community IDs by category
 * @param {string} category - Category name
 * @returns {Array} Array of community IDs
 */
async function getCommunityIdsByCategory(category) {
  try {
    const snapshot = await db
      .collection('communities')
      .where('category', '==', category)
      .where('isDeleted', '==', false)
      .select('id')
      .get();

    return snapshot.docs.map(doc => doc.id);
  } catch (error) {
    logger.error('Failed to get community IDs by category', { error: error.message, category });
    return [];
  }
}

/**
 * Check if document matches search query
 * @param {Object} doc - Document data
 * @param {string} query - Search query
 * @returns {boolean} True if matches
 */
function matchesQuery(doc, query) {
  if (!query || query.trim() === '') return true;

  const searchQuery = query.toLowerCase().trim();
  const searchableFields = [];

  // Extract searchable text fields based on document type
  if (doc.title) searchableFields.push(doc.title);
  if (doc.content) searchableFields.push(doc.content);
  if (doc.name) searchableFields.push(doc.name);
  if (doc.description) searchableFields.push(doc.description);
  if (doc.nickname) searchableFields.push(doc.nickname);
  if (doc.tags && Array.isArray(doc.tags)) {
    searchableFields.push(...doc.tags);
  }

  // Check if any field contains the query
  return searchableFields.some(field => field && field.toLowerCase().includes(searchQuery));
}

module.exports = {
  globalSearch,
  searchPosts,
  searchCommunities,
  searchUsers,
  getTrendingPosts,
};
