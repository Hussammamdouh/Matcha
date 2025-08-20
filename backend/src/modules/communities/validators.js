const { body, query, param, validationResult } = require('express-validator');
const { sanitizeHtml, validateContentLength } = require('../../lib/sanitize');

/**
 * Validation schemas for community endpoints
 */

// Create community validation
const createCommunityValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Community name must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      'Community name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    .customSanitizer(value => sanitizeHtml(value)),

  body('slug')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Community slug must be between 3 and 30 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Community slug can only contain lowercase letters, numbers, and hyphens')
    .customSanitizer(value => value.toLowerCase()),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Community description must be less than 500 characters')
    .customSanitizer(value => sanitizeHtml(value)),

  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category must be less than 50 characters'),

  body('isPrivate').optional().isBoolean().withMessage('isPrivate must be a boolean'),

  body('rules')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Rules must be an array with maximum 20 items'),

  body('rules.*.title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Rule title must be between 1 and 100 characters')
    .customSanitizer(value => sanitizeHtml(value)),

  body('rules.*.text')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Rule text must be less than 500 characters')
    .customSanitizer(value => sanitizeHtml(value)),

  body('tags')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Tags must be an array with maximum 10 items'),

  body('tags.*')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Each tag must be between 1 and 20 characters')
    .matches(/^[a-zA-Z0-9\-\s]+$/)
    .withMessage('Tags can only contain letters, numbers, hyphens, and spaces')
    .customSanitizer(value => sanitizeHtml(value)),
];

// Update community validation
const updateCommunityValidation = [
  param('id').isString().trim().notEmpty().withMessage('Community ID is required'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Community name must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      'Community name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    .customSanitizer(value => sanitizeHtml(value)),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Community description must be less than 500 characters')
    .customSanitizer(value => sanitizeHtml(value)),

  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category must be less than 50 characters'),

  body('rules')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Rules must be an array with maximum 20 items'),

  body('rules.*.title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Rule title must be between 1 and 100 characters')
    .customSanitizer(value => sanitizeHtml(value)),

  body('rules.*.text')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Rule text must be less than 500 characters')
    .customSanitizer(value => sanitizeHtml(value)),

  body('tags')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Tags must be an array with maximum 10 items'),

  body('tags.*')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Each tag must be between 1 and 20 characters')
    .matches(/^[a-zA-Z0-9\-\s]+$/)
    .withMessage('Tags can only contain letters, numbers, hyphens, and spaces')
    .customSanitizer(value => sanitizeHtml(value)),
];

// List communities validation
const listCommunitiesValidation = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query must be less than 100 characters'),

  query('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category must be less than 50 characters'),

  query('sort')
    .optional()
    .isIn(['trending', 'new', 'top'])
    .withMessage('Sort must be one of: trending, new, top'),

  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Page size must be between 1 and 50'),

  query('cursor').optional().isString().withMessage('Cursor must be a string'),
];

// Get community validation
const getCommunityValidation = [
  param('id').isString().trim().notEmpty().withMessage('Community ID is required'),
];

// Join/Leave community validation
const joinLeaveCommunityValidation = [
  param('id').isString().trim().notEmpty().withMessage('Community ID is required'),
];

// Get moderators validation
const getModeratorsValidation = [
  param('id').isString().trim().notEmpty().withMessage('Community ID is required'),
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
  createCommunityValidation,
  updateCommunityValidation,
  listCommunitiesValidation,
  getCommunityValidation,
  joinLeaveCommunityValidation,
  getModeratorsValidation,
  validate,
};
