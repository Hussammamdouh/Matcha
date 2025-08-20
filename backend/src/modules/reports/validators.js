const { body, query, param, validationResult } = require('express-validator');

/**
 * Validation schemas for report endpoints
 */

// Create report validation
const createReportValidation = [
  body('contentType')
    .isIn(['post', 'comment', 'user', 'community'])
    .withMessage('Content type must be one of: post, comment, user, community'),

  body('contentId').isString().trim().notEmpty().withMessage('Content ID is required'),

  body('reason')
    .isIn(['spam', 'harassment', 'hate_speech', 'violence', 'misinformation', 'copyright', 'other'])
    .withMessage('Invalid reason code'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1,000 characters'),
];

// Update report validation
const updateReportValidation = [
  param('id').isString().trim().notEmpty().withMessage('Report ID is required'),

  body('status')
    .isIn(['pending', 'investigating', 'resolved', 'dismissed'])
    .withMessage('Status must be one of: pending, investigating, resolved, dismissed'),

  body('moderatorNotes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Moderator notes must be less than 1,000 characters'),

  body('action')
    .optional()
    .isIn(['warning', 'temporary_ban', 'permanent_ban', 'content_removal', 'none'])
    .withMessage(
      'Action must be one of: warning, temporary_ban, permanent_ban, content_removal, none'
    ),
];

// Get report validation
const getReportValidation = [
  param('id').isString().trim().notEmpty().withMessage('Report ID is required'),
];

// List reports validation
const listReportsValidation = [
  query('status')
    .optional()
    .isIn(['pending', 'investigating', 'resolved', 'dismissed'])
    .withMessage('Status must be one of: pending, investigating, resolved, dismissed'),

  query('contentType')
    .optional()
    .isIn(['post', 'comment', 'user', 'community'])
    .withMessage('Content type must be one of: post, comment, user, community'),

  query('reason')
    .optional()
    .isIn(['spam', 'harassment', 'hate_speech', 'violence', 'misinformation', 'copyright', 'other'])
    .withMessage('Invalid reason code'),

  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Page size must be between 1 and 100'),

  query('cursor').optional().isString().withMessage('Cursor must be a string'),
];

// Get user reports validation
const getUserReportsValidation = [
  param('userId').isString().trim().notEmpty().withMessage('User ID is required'),

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
  createReportValidation,
  updateReportValidation,
  getReportValidation,
  listReportsValidation,
  getUserReportsValidation,
  validate,
};
