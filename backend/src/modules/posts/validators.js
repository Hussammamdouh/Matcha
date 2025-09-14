const { body, query, param, validationResult } = require('express-validator');
const { sanitizeHtml, validateContentLength } = require('../../lib/sanitize');
const { features } = require('../../config');

/**
 * Validation schemas for post endpoints
 */

// Create post validation (supports public posts without communityId)
const createPostValidation = [
  body('visibility')
    .optional()
    .isIn(['public', 'community'])
    .withMessage('Visibility must be public or community'),

  body('communityId')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Community ID must be a non-empty string when provided'),

  body('title')
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Post title must be between 1 and 120 characters')
    .customSanitizer(value => sanitizeHtml(value)),

  body('body')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Post body must be between 1 and 10,000 characters')
    .customSanitizer(value => sanitizeHtml(value)),

  body('mediaDescriptors')
    .optional()
    .isArray({ max: 5 })
    .withMessage('Maximum 5 media files allowed'),

  body('mediaDescriptors.*.type')
    .optional()
    .isIn(['image', 'audio'])
    .withMessage('Media type must be either "image" or "audio"')
    .custom(value => {
      if (value === 'audio' && !features.voicePosts) {
        throw new Error('Voice posts are currently disabled');
      }
      return value;
    }),

  body('mediaDescriptors.*.mime')
    .optional()
    .isString()
    .withMessage('MIME type is required for media files'),

  body('mediaDescriptors.*.size')
    .optional()
    .isInt({ min: 1 })
    .withMessage('File size must be a positive integer'),

  body('tags').optional().isArray({ max: 10 }).withMessage('Maximum 10 tags allowed'),

  body('tags.*')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Each tag must be between 1 and 20 characters')
    .matches(/^[a-zA-Z0-9\-\s]+$/)
    .withMessage('Tags can only contain letters, numbers, hyphens, and spaces')
    .customSanitizer(value => sanitizeHtml(value)),
];

// Update post validation
const updatePostValidation = [
  param('id').isString().trim().notEmpty().withMessage('Post ID is required'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Post title must be between 1 and 120 characters')
    .customSanitizer(value => sanitizeHtml(value)),

  body('body')
    .optional()
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Post body must be between 1 and 10,000 characters')
    .customSanitizer(value => sanitizeHtml(value)),

  body('tags').optional().isArray({ max: 10 }).withMessage('Maximum 10 tags allowed'),

  body('tags.*')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Each tag must be between 1 and 20 characters')
    .matches(/^[a-zA-Z0-9\-\s]+$/)
    .withMessage('Tags can only contain letters, numbers, hyphens, and spaces')
    .customSanitizer(value => sanitizeHtml(value)),
];

// Get post validation
const getPostValidation = [
  param('id').isString().trim().notEmpty().withMessage('Post ID is required'),
];

// Vote on post validation
const votePostValidation = [
  param('id').isString().trim().notEmpty().withMessage('Post ID is required'),

  body('value')
    .isInt({ min: -1, max: 1 })
    .withMessage('Vote value must be -1 (downvote), 0 (remove vote), or 1 (upvote)'),
];

// Save/unsave post validation
const savePostValidation = [
  param('id').isString().trim().notEmpty().withMessage('Post ID is required'),
];

// Get feed validation
const getFeedValidation = [
  query('sort')
    .optional()
    .isIn(['hot', 'new', 'top_24h', 'top_7d', 'top_all'])
    .withMessage('Sort must be one of: hot, new, top_24h, top_7d, top_all'),

  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Page size must be between 1 and 50'),

  query('cursor').optional().isString().withMessage('Cursor must be a string'),
];

// Get community posts validation
const getCommunityPostsValidation = [
  param('communityId').isString().trim().notEmpty().withMessage('Community ID is required'),

  query('sort')
    .optional()
    .isIn(['hot', 'new', 'top_24h', 'top_7d', 'top_all'])
    .withMessage('Sort must be one of: hot, new, top_24h, top_7d, top_all'),

  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Page size must be between 1 and 50'),

  query('cursor').optional().isString().withMessage('Cursor must be a string'),
];

// Get saved posts validation
const getSavedPostsValidation = [
  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Page size must be between 1 and 50'),

  query('cursor').optional().isString().withMessage('Cursor must be a string'),
];

/**
 * Centralized validation result handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array().map(error => ({
          field: error.path,
          message: error.msg,
          value: error.value,
        })),
      },
    });
  }
  next();
}

module.exports = {
  createPostValidation,
  updatePostValidation,
  getPostValidation,
  votePostValidation,
  savePostValidation,
  getFeedValidation,
  getCommunityPostsValidation,
  getSavedPostsValidation,
  validate,
};
