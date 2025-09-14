const { body, query } = require('express-validator');

/**
 * Validation for updating user settings
 */
const updateSettingsValidation = [
  body('accountPrivacy')
    .optional()
    .isIn(['public', 'private'])
    .withMessage('Account privacy must be either "public" or "private"'),
  
  body('showLikedPosts')
    .optional()
    .isBoolean()
    .withMessage('showLikedPosts must be a boolean value'),
  
  body('showFollowing')
    .optional()
    .isBoolean()
    .withMessage('showFollowing must be a boolean value'),
  
  body('showFollowers')
    .optional()
    .isBoolean()
    .withMessage('showFollowers must be a boolean value'),
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

module.exports = {
  updateSettingsValidation,
  paginationValidation,
};
