const { body, query, param, validationResult } = require('express-validator');
const { sanitizeHtml } = require('../../lib/sanitize');

/**
 * Validation schemas for comment endpoints
 */

// Create comment validation (postId comes from URL params)
const createCommentValidation = [
  body('body')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment body must be between 1 and 2,000 characters')
    .customSanitizer(value => sanitizeHtml(value)),

  body('parentId')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Parent comment ID must be a valid string'),

  // Optional media on comments
  body('media')
    .optional()
    .isArray({ max: 3 })
    .withMessage('Maximum 3 media items allowed'),

  body('media.*.url').optional().isURL().withMessage('media.url must be a valid URL'),
  body('media.*.type')
    .optional()
    .isIn(['image', 'audio', 'video'])
    .withMessage('media.type must be image, audio, or video'),
];

// Update comment validation
const updateCommentValidation = [
  param('commentId').isString().trim().notEmpty().withMessage('Comment ID is required'),

  body('body')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment body must be between 1 and 2,000 characters')
    .customSanitizer(value => sanitizeHtml(value)),
];

// Get comment validation
const getCommentValidation = [
  param('commentId').isString().trim().notEmpty().withMessage('Comment ID is required'),
];

// Vote on comment validation
const voteCommentValidation = [
  param('commentId').isString().trim().notEmpty().withMessage('Comment ID is required'),

  body('value')
    .isInt({ min: -1, max: 1 })
    .withMessage('Vote value must be -1 (downvote), 0 (remove vote), or 1 (upvote)'),
];

// Get post comments validation
const getPostCommentsValidation = [
  param('postId').isString().trim().notEmpty().withMessage('Post ID is required'),

  query('sort')
    .optional()
    .isIn(['top', 'new', 'old'])
    .withMessage('Sort must be one of: top, new, old'),

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
  createCommentValidation,
  updateCommentValidation,
  getCommentValidation,
  voteCommentValidation,
  getPostCommentsValidation,
  validate,
};
