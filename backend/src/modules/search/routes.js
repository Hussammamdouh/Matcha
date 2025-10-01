const express = require('express');
const { authenticateToken } = require('../../middlewares/auth');
const { generalRateLimiter } = require('../../middlewares/rateLimit');
const {
  globalSearchValidation,
  postSearchValidation,
  communitySearchValidation,
  userSearchValidation,
  trendingPostsValidation,
  validate,
} = require('./validators');
const {
  globalSearch,
  searchPosts,
  searchCommunities,
  searchUsers,
  searchMenReviews,
  getTrendingPosts,
} = require('./controller');

const router = express.Router();

// Global search across all content types
router.get(
  '/',
  authenticateToken,
  generalRateLimiter,
  globalSearchValidation,
  validate,
  globalSearch
);

// Unified search endpoint with filters
// GET /api/v1/search/unified?q=query&types=posts,users,communities&filters={...}
router.get(
  '/unified',
  authenticateToken,
  generalRateLimiter,
  async (req, res) => {
    try {
      const { q, types, filters, limit = 20, offset = 0 } = req.query;
      
      if (!q) {
        return res.status(400).json({
          ok: false,
          error: { code: 'MISSING_QUERY', message: 'Query parameter q is required' }
        });
      }

      const searchTypes = types ? types.split(',') : ['posts', 'users', 'communities', 'menReviews'];
      const validTypes = ['posts', 'users', 'communities', 'menReviews', 'trending'];
      
      const invalidTypes = searchTypes.filter(type => !validTypes.includes(type));
      if (invalidTypes.length > 0) {
        return res.status(400).json({
          ok: false,
          error: { 
            code: 'INVALID_TYPES', 
            message: `Invalid types: ${invalidTypes.join(', ')}. Valid types: ${validTypes.join(', ')}` 
          }
        });
      }

      const results = {};
      const searchPromises = [];

      // Parse filters
      let parsedFilters = {};
      if (filters) {
        try {
          parsedFilters = JSON.parse(filters);
        } catch (e) {
          return res.status(400).json({
            ok: false,
            error: { code: 'INVALID_FILTERS', message: 'Filters must be valid JSON' }
          });
        }
      }

      // Search each type in parallel
      if (searchTypes.includes('posts')) {
        searchPromises.push(
          searchPosts({ ...req, query: { ...req.query, q, limit, offset, ...parsedFilters } }, { json: (data) => results.posts = data })
        );
      }

      if (searchTypes.includes('users')) {
        searchPromises.push(
          searchUsers({ ...req, query: { ...req.query, q, limit, offset, ...parsedFilters } }, { json: (data) => results.users = data })
        );
      }

      if (searchTypes.includes('communities')) {
        searchPromises.push(
          searchCommunities({ ...req, query: { ...req.query, q, limit, offset, ...parsedFilters } }, { json: (data) => results.communities = data })
        );
      }

      if (searchTypes.includes('menReviews')) {
        searchPromises.push(
          searchMenReviews({ ...req, query: { ...req.query, q, limit, offset, ...parsedFilters } }, { json: (data) => results.menReviews = data })
        );
      }

      if (searchTypes.includes('trending')) {
        searchPromises.push(
          getTrendingPosts({ ...req, query: { ...req.query, limit, offset, ...parsedFilters } }, { json: (data) => results.trending = data })
        );
      }

      await Promise.allSettled(searchPromises);

      res.json({
        ok: true,
        data: {
          query: q,
          types: searchTypes,
          results,
          meta: {
            totalTypes: searchTypes.length,
            limit: parseInt(limit),
            offset: parseInt(offset)
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: { code: 'SEARCH_FAILED', message: 'Failed to perform unified search' }
      });
    }
  }
);

// Search specific content types
router.get(
  '/posts',
  authenticateToken,
  generalRateLimiter,
  postSearchValidation,
  validate,
  searchPosts
);
router.get(
  '/communities',
  authenticateToken,
  generalRateLimiter,
  communitySearchValidation,
  validate,
  searchCommunities
);
router.get(
  '/users',
  authenticateToken,
  generalRateLimiter,
  userSearchValidation,
  validate,
  searchUsers
);

// Search men reviews
router.get(
  '/menReviews',
  authenticateToken,
  generalRateLimiter,
  userSearchValidation,
  validate,
  searchMenReviews
);

// Trending posts
router.get(
  '/trending',
  authenticateToken,
  generalRateLimiter,
  trendingPostsValidation,
  validate,
  getTrendingPosts
);

module.exports = router;
