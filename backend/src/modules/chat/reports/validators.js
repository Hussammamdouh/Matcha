const { body, query, param, validationResult } = require('express-validator');

/**
 * Validation for creating a chat report
 */
const createReportValidation = [
  body('type')
    .isIn(['message', 'conversation', 'user'])
    .withMessage('type must be one of: message, conversation, user'),
  body('targetId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage('targetId must be a non-empty string'),
  body('conversationId')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage('conversationId must be a non-empty string'),
  body('reasonCode')
    .isIn(['spam', 'harassment', 'inappropriate_content', 'violence', 'fake_news', 'copyright', 'other'])
    .withMessage('reasonCode must be a valid reason code'),
  body('note')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('note must be a string with maximum 1000 characters'),
];

/**
 * Validation for getting chat reports
 */
const getReportsValidation = [
  query('status')
    .optional()
    .isIn(['new', 'in_review', 'resolved', 'dismissed'])
    .withMessage('status must be a valid status'),
  query('type')
    .optional()
    .isIn(['message', 'conversation', 'user'])
    .withMessage('type must be a valid type'),
  query('reporterId')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage('reporterId must be a non-empty string'),
  query('conversationId')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage('conversationId must be a non-empty string'),
  query('cursor')
    .optional()
    .isString()
    .trim()
    .withMessage('cursor must be a string'),
  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('pageSize must be an integer between 1 and 100'),
];

/**
 * Validation for getting a specific chat report
 */
const getReportValidation = [
  param('id')
    .isString()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage('id must be a non-empty string'),
];

/**
 * Validation for updating report status
 */
const updateReportStatusValidation = [
  param('id')
    .isString()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage('id must be a non-empty string'),
  body('status')
    .isIn(['in_review', 'resolved', 'dismissed'])
    .withMessage('status must be one of: in_review, resolved, dismissed'),
  body('resolutionNote')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('resolutionNote must be a string with maximum 1000 characters'),
];

/**
 * Middleware to handle validation results
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
        })),
      },
    });
  }
  next();
}

module.exports = {
  createReportValidation,
  getReportsValidation,
  getReportValidation,
  updateReportStatusValidation,
  validate,
};
