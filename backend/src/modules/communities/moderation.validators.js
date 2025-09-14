const { body, param, query } = require('express-validator');

/**
 * Validation for adding a moderator
 */
const addModeratorValidation = [
  body('userId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('userId must be a valid string'),
];

/**
 * Validation for banning a user
 */
const banUserValidation = [
  body('userId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('userId must be a valid string'),
  
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 0, max: 500 })
    .withMessage('reason must be a string with max 500 characters'),
];

/**
 * Validation for pagination query parameters
 */
const paginationValidation = [
  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('pageSize must be between 1 and 100'),
  
  query('cursor')
    .optional()
    .isString()
    .withMessage('cursor must be a string'),
];

/**
 * Validation for community ID parameter
 */
const communityIdValidation = [
  param('id')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Community ID must be a valid string'),
];

/**
 * Validation for user ID parameter
 */
const userIdValidation = [
  param('userId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('User ID must be a valid string'),
];

module.exports = {
  addModeratorValidation,
  banUserValidation,
  paginationValidation,
  communityIdValidation,
  userIdValidation,
};
