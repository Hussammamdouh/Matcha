const { body, query, param, validationResult } = require('express-validator');

/**
 * Validation for getting unified reports
 */
const getUnifiedReportsValidation = [
  query('status')
    .optional()
    .isIn(['new', 'in_review', 'resolved', 'dismissed'])
    .withMessage('Status must be one of: new, in_review, resolved, dismissed'),
  
  query('surface')
    .optional()
    .isIn(['feed', 'chat', 'men'])
    .withMessage('Surface must be one of: feed, chat, men'),
  
  query('entityType')
    .optional()
    .isIn(['post', 'comment', 'message', 'subject', 'user'])
    .withMessage('Entity type must be one of: post, comment, message, subject, user'),
  
  query('communityId')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Community ID must be a non-empty string'),
  
  query('from')
    .optional()
    .isISO8601()
    .withMessage('From date must be a valid ISO 8601 date'),
  
  query('to')
    .optional()
    .isISO8601()
    .withMessage('To date must be a valid ISO 8601 date'),
  
  query('cursor')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Cursor must be a non-empty string'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be an integer between 1 and 50'),
];

/**
 * Validation for claiming a report
 */
const claimReportValidation = [
  param('id')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Report ID must be a non-empty string'),
  
  body('surface')
    .isIn(['feed', 'chat', 'men'])
    .withMessage('Surface must be one of: feed, chat, men'),
];

/**
 * Validation for resolving a report
 */
const resolveReportValidation = [
  param('id')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Report ID must be a non-empty string'),
  
  body('surface')
    .isIn(['feed', 'chat', 'men'])
    .withMessage('Surface must be one of: feed, chat, men'),
  
  body('resolutionCode')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Resolution code is required'),
  
  body('note')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Note must be a string with maximum 1000 characters'),
];

/**
 * Validation for dismissing a report
 */
const dismissReportValidation = [
  param('id')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Report ID must be a non-empty string'),
  
  body('surface')
    .isIn(['feed', 'chat', 'men'])
    .withMessage('Surface must be one of: feed, chat, men'),
  
  body('note')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Note must be a string with maximum 1000 characters'),
];

/**
 * Validation for bulk resolving reports
 */
const bulkResolveReportsValidation = [
  body('reportIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Report IDs must be an array with 1-100 items'),
  
  body('reportIds.*')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Each report ID must be a non-empty string'),
  
  body('surface')
    .isIn(['feed', 'chat', 'men'])
    .withMessage('Surface must be one of: feed, chat, men'),
  
  body('resolutionCode')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Resolution code is required'),
  
  body('note')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Note must be a string with maximum 1000 characters'),
];

/**
 * Validation for bulk dismissing reports
 */
const bulkDismissReportsValidation = [
  body('reportIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Report IDs must be an array with 1-100 items'),
  
  body('reportIds.*')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Each report ID must be a non-empty string'),
  
  body('surface')
    .isIn(['feed', 'chat', 'men'])
    .withMessage('Surface must be one of: feed, chat, men'),
  
  body('note')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Note must be a string with maximum 1000 characters'),
];

/**
 * Validation for setting user role
 */
const setUserRoleValidation = [
  param('uid')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('User ID must be a non-empty string'),
  
  body('role')
    .isIn(['admin', 'moderator', 'user'])
    .withMessage('Role must be one of: admin, moderator, user'),
];

/**
 * Validation for banning a user
 */
const banUserValidation = [
  param('uid')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('User ID must be a non-empty string'),
  
  body('reason')
    .isString()
    .trim()
    .notEmpty()
    .isLength({ max: 1000 })
    .withMessage('Reason must be a non-empty string with maximum 1000 characters'),
  
  body('until')
    .optional()
    .isISO8601()
    .withMessage('Until date must be a valid ISO 8601 date'),
];

/**
 * Validation for unbanning a user
 */
const unbanUserValidation = [
  param('uid')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('User ID must be a non-empty string'),
];

/**
 * Validation for shadowbanning a user
 */
const shadowbanUserValidation = [
  param('uid')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('User ID must be a non-empty string'),
  
  body('reason')
    .isString()
    .trim()
    .notEmpty()
    .isLength({ max: 1000 })
    .withMessage('Reason must be a non-empty string with maximum 1000 characters'),
];

/**
 * Validation for removing shadowban from user
 */
const unshadowbanUserValidation = [
  param('uid')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('User ID must be a non-empty string'),
];

/**
 * Validation for logging out all user sessions
 */
const logoutAllUserSessionsValidation = [
  param('uid')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('User ID must be a non-empty string'),
];

/**
 * Validation for searching users
 */
const searchUsersValidation = [
  query('q')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be a string with 1-100 characters'),
  
  query('status')
    .optional()
    .isIn(['active', 'suspended'])
    .withMessage('Status must be one of: active, suspended'),
  
  query('role')
    .optional()
    .isIn(['admin', 'moderator', 'user'])
    .withMessage('Role must be one of: admin, moderator, user'),
  
  query('cursor')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Cursor must be a non-empty string'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be an integer between 1 and 50'),
];

/**
 * Validation for getting user details
 */
const getUserDetailsValidation = [
  param('uid')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('User ID must be a non-empty string'),
];

/**
 * Validation for getting features
 */
const getFeaturesValidation = [
  // No validation needed for GET request
];

/**
 * Validation for updating features
 */
const updateFeaturesValidation = [
  body('updates')
    .isObject()
    .withMessage('Updates must be an object'),
  
  body('updates.*')
    .isBoolean()
    .withMessage('Each feature value must be a boolean'),
];

/**
 * Validation for updating retention settings
 */
const updateRetentionValidation = [
  body('menOriginalRetentionDays')
    .isInt({ min: 1, max: 365 })
    .withMessage('menOriginalRetentionDays must be an integer between 1 and 365')
];

/**
 * Validation for creating export job
 */
const createExportJobValidation = [
  param('uid')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('User ID must be a non-empty string'),
  
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
  
  body('options.includePosts')
    .optional()
    .isBoolean()
    .withMessage('includePosts must be a boolean'),
  
  body('options.includeComments')
    .optional()
    .isBoolean()
    .withMessage('includeComments must be a boolean'),
  
  body('options.includeMessages')
    .optional()
    .isBoolean()
    .withMessage('includeMessages must be a boolean'),
  
  body('options.includeMenSubjects')
    .optional()
    .isBoolean()
    .withMessage('includeMenSubjects must be a boolean'),
  
  body('options.includeReports')
    .optional()
    .isBoolean()
    .withMessage('includeReports must be a boolean'),
];

/**
 * Validation for getting export job
 */
const getExportJobValidation = [
  param('jobId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Job ID must be a non-empty string'),
];

/**
 * Validation for getting audit logs
 */
const getAuditLogsValidation = [
  query('actorId')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Actor ID must be a non-empty string'),
  
  query('action')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Action must be a non-empty string'),
  
  query('entityType')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Entity type must be a non-empty string'),
  
  query('from')
    .optional()
    .isISO8601()
    .withMessage('From date must be a valid ISO 8601 date'),
  
  query('to')
    .optional()
    .isISO8601()
    .withMessage('To date must be a valid ISO 8601 date'),
  
  query('cursor')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Cursor must be a non-empty string'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be an integer between 1 and 50'),
];

/**
 * Generic validation middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const fieldErrors = {};
    
    errors.array().forEach(error => {
      if (!fieldErrors[error.path]) {
        fieldErrors[error.path] = [];
      }
      fieldErrors[error.path].push(error.msg);
    });
    
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        fields: fieldErrors,
      },
    });
  }
  
  next();
}

module.exports = {
  // Reports
  getUnifiedReportsValidation,
  claimReportValidation,
  resolveReportValidation,
  dismissReportValidation,
  bulkResolveReportsValidation,
  bulkDismissReportsValidation,
  
  // Users
  setUserRoleValidation,
  banUserValidation,
  unbanUserValidation,
  shadowbanUserValidation,
  unshadowbanUserValidation,
  logoutAllUserSessionsValidation,
  searchUsersValidation,
  getUserDetailsValidation,
  
  // Features
  getFeaturesValidation,
  updateFeaturesValidation,
  updateRetentionValidation,
  
  // Exports
  createExportJobValidation,
  getExportJobValidation,
  
  // Audits
  getAuditLogsValidation,
  
  // Generic validation
  validate,
};
