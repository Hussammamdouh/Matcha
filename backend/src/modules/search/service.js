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
    // Very simple query - just get all posts and filter in memory
    const snapshot = await db.collection('posts').limit(50).get();
    const posts = [];

    snapshot.forEach(doc => {
      const post = doc.data();
      if (!post.isDeleted && matchesQuery(post, query)) {
        posts.push({
          id: doc.id,
          ...post,
        });
      }
    });

    // Sort by createdAt (most recent first)
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Limit results
    const limitedPosts = posts.slice(0, limit);

    return {
      results: limitedPosts,
      total: limitedPosts.length,
      nextCursor: null, // Simplified - no cursor for now
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
    // Very simple query - just get all communities and filter in memory
    const snapshot = await db.collection('communities').limit(50).get();
    const communities = [];

    snapshot.forEach(doc => {
      const community = doc.data();
      if (!community.isDeleted && matchesQuery(community, query)) {
        communities.push({
          id: doc.id,
          ...community,
        });
      }
    });

    // Sort by createdAt (most recent first)
    communities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Limit results
    const limitedCommunities = communities.slice(0, limit);

    return {
      results: limitedCommunities,
      total: limitedCommunities.length,
      nextCursor: null, // Simplified - no cursor for now
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
    // Very simple query - just get all users and filter in memory
    const snapshot = await db.collection('users').limit(50).get();
    const users = [];

    snapshot.forEach(doc => {
      const user = doc.data();
      if (!user.isDeleted && matchesQuery(user, query)) {
        users.push({
          id: doc.id,
          nickname: user.nickname,
          avatar: user.avatar,
          score: user.score || 0,
          createdAt: user.createdAt,
        });
      }
    });

    // Sort by createdAt (most recent first)
    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Limit results
    const limitedUsers = users.slice(0, limit);

    return {
      results: limitedUsers,
      total: limitedUsers.length,
      nextCursor: null, // Simplified - no cursor for now
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
    // Very simple query - just get recent posts
    const snapshot = await db.collection('posts').limit(50).get();
    const posts = [];

    snapshot.forEach(doc => {
      const post = doc.data();
      if (!post.isDeleted) {
        posts.push({
          id: doc.id,
          ...post,
        });
      }
    });

    // Sort by createdAt (most recent first)
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Limit results
    const limitedPosts = posts.slice(0, limit);

    return {
      results: limitedPosts,
      total: limitedPosts.length,
      nextCursor: null, // Simplified - no cursor for now
    };
  } catch (error) {
    logger.error('Trending posts search failed', { error: error.message });
    throw error;
  }
}

/**
 * Search men reviews by query
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Object} Search results
 */
async function searchMenReviews(query, options = {}) {
  const { sortBy, cursor, limit } = options;

  try {
    // Very simple query - just get all reviews and filter in memory
    const snapshot = await db.collection('menReviews').limit(50).get();
    const reviews = [];

    snapshot.forEach(doc => {
      const review = doc.data();
      if (!review.isDeleted && matchesQuery(review, query)) {
        reviews.push({
          id: doc.id,
          ...review,
        });
      }
    });

    // Sort by createdAt (most recent first)
    reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Limit results
    const limitedReviews = reviews.slice(0, limit);

    return {
      results: limitedReviews,
      total: limitedReviews.length,
      nextCursor: null, // Simplified - no cursor for now
    };
  } catch (error) {
    logger.error('Men reviews search failed', { error: error.message, query });
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
 * Generate cursor for pagination
 * @param {Object} doc - Firestore document snapshot
 * @returns {string} Encoded cursor
 */
function generateCursor(doc) {
  return encodeCursor({ 
    id: doc.id, 
    createdAt: doc.get('createdAt') 
  });
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
  searchMenReviews,
  getTrendingPosts,
};
