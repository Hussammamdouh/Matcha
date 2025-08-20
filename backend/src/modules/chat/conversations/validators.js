const { body, query, param, validationResult } = require('express-validator');

// Create conversation validation
const createConversationValidation = [
  body('type')
    .isIn(['direct', 'group'])
    .withMessage('Type must be either "direct" or "group"'),
  body('title')
    .if(body('type').equals('group'))
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage('Group title must be between 1 and 80 characters'),
  body('icon')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Icon URL must be less than 200 characters'),
  body('memberUserIds')
    .isArray({ min: 1 })
    .withMessage('memberUserIds must be a non-empty array'),
  body('memberUserIds.*')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Each memberUserIds element must be a non-empty string'),
];

// Get conversation validation
const getConversationValidation = [
  param('id')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Conversation ID is required'),
];

// List conversations validation
const listConversationsValidation = [
  query('cursor')
    .optional()
    .isString()
    .withMessage('Cursor must be a string'),
  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Page size must be between 1 and 50'),
];

// Join conversation validation
const joinConversationValidation = [
  param('id')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Conversation ID is required'),
];

// Leave conversation validation
const leaveConversationValidation = [
  param('id')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Conversation ID is required'),
];

// Update conversation validation
const updateConversationValidation = [
  param('id')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Conversation ID is required'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage('Title must be between 1 and 80 characters'),
  body('icon')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Icon URL must be less than 200 characters'),
  body('isLocked')
    .optional()
    .isBoolean()
    .withMessage('isLocked must be a boolean'),
];

// Toggle mute validation
const toggleMuteValidation = [
  param('id')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Conversation ID is required'),
  body('isMuted')
    .isBoolean()
    .withMessage('isMuted must be a boolean'),
];

// Generic validation middleware
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array(),
      },
    });
  }
  next();
}

module.exports = {
  createConversationValidation,
  getConversationValidation,
  listConversationsValidation,
  joinConversationValidation,
  leaveConversationValidation,
  updateConversationValidation,
  toggleMuteValidation,
  validate,
};
