const { body, query, param, validationResult } = require('express-validator');

/**
 * Validation for blocking a user
 */
const blockUserValidation = [
  body('blockedUserId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage('blockedUserId must be a non-empty string'),
];

/**
 * Validation for unblocking a user
 */
const unblockUserValidation = [
  param('blockedUserId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage('blockedUserId must be a non-empty string'),
];

/**
 * Validation for getting blocked users
 */
const getBlockedUsersValidation = [
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
  blockUserValidation,
  unblockUserValidation,
  getBlockedUsersValidation,
  validate,
};
