const { createModuleLogger } = require('../../lib/logger');
const searchService = require('./service');

const logger = createModuleLogger();

/**
 * Enhanced global search across all content types with sections
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function globalSearch(req, res) {
  try {
    const { q: query, type, category, sortBy, cursor, limit } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        ok: false,
        error: 'Search query is required',
        code: 'MISSING_QUERY',
      });
    }

    const results = await searchService.globalSearch(query, {
      type,
      category,
      sortBy,
      cursor,
      limit: limit ? parseInt(limit) : 10, // Default to 10 per section
    });

    logger.info('Enhanced global search request processed', {
      userId: req.user?.uid,
      query,
      type,
      totalResults: results.meta.totalResults,
      sectionsFound: results.meta.sectionsFound,
    });

    res.json({
      ok: true,
      data: {
        query,
        sections: results.sections,
        meta: {
          query,
          type: type || 'all',
          category: category || null,
          sortBy: sortBy || 'relevance',
          totalResults: results.meta.totalResults,
          sectionsFound: results.meta.sectionsFound,
          hasNextPage: !!results.meta.nextCursor,
          nextCursor: results.meta.nextCursor,
        },
      },
    });
  } catch (error) {
    logger.error('Enhanced global search failed', {
      error: error.message,
      userId: req.user?.uid,
      query: req.query.q,
    });

    res.status(500).json({
      ok: false,
      error: 'Search failed',
      code: 'SEARCH_ERROR',
    });
  }
}

/**
 * Search posts only
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function searchPosts(req, res) {
  try {
    const { q: query, category, sortBy, cursor, limit } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        ok: false,
        error: 'Search query is required',
        code: 'MISSING_QUERY',
      });
    }

    const results = await searchService.searchPosts(query, {
      category,
      sortBy,
      cursor,
      limit: limit ? parseInt(limit) : 20,
    });

    logger.info('Post search request processed', {
      userId: req.user?.uid,
      query,
      category,
      totalResults: results.total,
    });

    res.json({
      ok: true,
      data: {
        posts: results.results,
        total: results.total,
      },
      meta: {
        query,
        category: category || null,
        sortBy: sortBy || 'relevance',
        hasNextPage: !!results.nextCursor,
        nextCursor: results.nextCursor,
      },
    });
  } catch (error) {
    logger.error('Post search failed', {
      error: error.message,
      userId: req.user?.uid,
      query: req.query.q,
    });

    res.status(500).json({
      ok: false,
      error: 'Post search failed',
      code: 'SEARCH_ERROR',
    });
  }
}

/**
 * Search communities only
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function searchCommunities(req, res) {
  try {
    const { q: query, category, sortBy, cursor, limit } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        ok: false,
        error: 'Search query is required',
        code: 'MISSING_QUERY',
      });
    }

    const results = await searchService.searchCommunities(query, {
      category,
      sortBy,
      cursor,
      limit: limit ? parseInt(limit) : 20,
    });

    logger.info('Community search request processed', {
      userId: req.user?.uid,
      query,
      category,
      totalResults: results.total,
    });

    res.json({
      ok: true,
      data: {
        communities: results.results,
        total: results.total,
      },
      meta: {
        query,
        category: category || null,
        sortBy: sortBy || 'relevance',
        hasNextPage: !!results.nextCursor,
        nextCursor: results.nextCursor,
      },
    });
  } catch (error) {
    logger.error('Community search failed', {
      error: error.message,
      userId: req.user?.uid,
      query: req.query.q,
    });

    res.status(500).json({
      ok: false,
      error: 'Community search failed',
      code: 'SEARCH_ERROR',
    });
  }
}

/**
 * Search users only
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function searchUsers(req, res) {
  try {
    const { q: query, sortBy, cursor, limit } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        ok: false,
        error: 'Search query is required',
        code: 'MISSING_QUERY',
      });
    }

    const results = await searchService.searchUsers(query, {
      sortBy,
      cursor,
      limit: limit ? parseInt(limit) : 20,
    });

    logger.info('User search request processed', {
      userId: req.user?.uid,
      query,
      totalResults: results.total,
    });

    res.json({
      ok: true,
      data: {
        users: results.results,
        total: results.total,
      },
      meta: {
        query,
        sortBy: sortBy || 'relevance',
        hasNextPage: !!results.nextCursor,
        nextCursor: results.nextCursor,
      },
    });
  } catch (error) {
    logger.error('User search failed', {
      error: error.message,
      userId: req.user?.uid,
      query: req.query.q,
    });

    res.status(500).json({
      ok: false,
      error: 'User search failed',
      code: 'SEARCH_ERROR',
    });
  }
}

/**
 * Search men reviews only
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function searchMenReviews(req, res) {
  try {
    const { q: query, sortBy, cursor, limit } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        ok: false,
        error: 'Search query is required',
        code: 'MISSING_QUERY',
      });
    }

    const results = await searchService.searchMenReviews(query, {
      sortBy,
      cursor,
      limit: limit ? parseInt(limit) : 20,
    });

    logger.info('Men reviews search request processed', {
      userId: req.user?.uid,
      query,
      totalResults: results.total,
    });

    res.json({
      ok: true,
      data: {
        menReviews: results.results,
        total: results.total,
      },
      meta: {
        query,
        sortBy: sortBy || 'relevance',
        hasNextPage: !!results.nextCursor,
        nextCursor: results.nextCursor,
      },
    });
  } catch (error) {
    logger.error('Men reviews search failed', {
      error: error.message,
      userId: req.user?.uid,
      query: req.query.q,
    });

    res.status(500).json({
      ok: false,
      error: 'Men reviews search failed',
      code: 'SEARCH_ERROR',
    });
  }
}

/**
 * Get trending posts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getTrendingPosts(req, res) {
  try {
    const { category, cursor, limit } = req.query;

    const results = await searchService.getTrendingPosts({
      category,
      cursor,
      limit: limit ? parseInt(limit) : 20,
    });

    logger.info('Trending posts request processed', {
      userId: req.user?.uid,
      category,
      totalResults: results.total,
    });

    res.json({
      ok: true,
      data: {
        posts: results.results,
        total: results.total,
      },
      meta: {
        category: category || null,
        hasNextPage: !!results.nextCursor,
        nextCursor: results.nextCursor,
      },
    });
  } catch (error) {
    logger.error('Trending posts failed', {
      error: error.message,
      userId: req.user?.uid,
    });

    res.status(500).json({
      ok: false,
      error: 'Failed to get trending posts',
      code: 'TRENDING_ERROR',
    });
  }
}

module.exports = {
  globalSearch,
  searchPosts,
  searchCommunities,
  searchUsers,
  searchMenReviews,
  getTrendingPosts,
};
