const { query, validationResult } = require('express-validator');

// Global search validation
const globalSearchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters')
    .escape(),
  query('type')
    .optional()
    .isIn(['all', 'posts', 'communities', 'users'])
    .withMessage('Type must be one of: all, posts, communities, users'),
  query('category')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters')
    .escape(),
  query('sortBy')
    .optional()
    .isIn(['relevance', 'score', 'createdAt', 'memberCount'])
    .withMessage('Sort by must be one of: relevance, score, createdAt, memberCount'),
  query('cursor').optional().isString().withMessage('Cursor must be a string'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

// Post search validation
const postSearchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters')
    .escape(),
  query('category')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters')
    .escape(),
  query('sortBy')
    .optional()
    .isIn(['relevance', 'score', 'createdAt'])
    .withMessage('Sort by must be one of: relevance, score, createdAt'),
  query('cursor').optional().isString().withMessage('Cursor must be a string'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

// Community search validation
const communitySearchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters')
    .escape(),
  query('category')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters')
    .escape(),
  query('sortBy')
    .optional()
    .isIn(['relevance', 'score', 'createdAt', 'memberCount'])
    .withMessage('Sort by must be one of: relevance, score, createdAt, memberCount'),
  query('cursor').optional().isString().withMessage('Cursor must be a string'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

// User search validation
const userSearchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters')
    .escape(),
  query('sortBy')
    .optional()
    .isIn(['relevance', 'score', 'createdAt'])
    .withMessage('Sort by must be one of: relevance, score, createdAt'),
  query('cursor').optional().isString().withMessage('Cursor must be a string'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

// Trending posts validation
const trendingPostsValidation = [
  query('category')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters')
    .escape(),
  query('cursor').optional().isString().withMessage('Cursor must be a string'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

/**
 * Validation middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array(),
    });
  }
  next();
}

module.exports = {
  globalSearchValidation,
  postSearchValidation,
  communitySearchValidation,
  userSearchValidation,
  trendingPostsValidation,
  validate,
};
