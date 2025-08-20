const { body, query, param, validationResult } = require('express-validator');

// Generate upload URL validation
const generateUploadUrlValidation = [
  body('filePath')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('File path must be between 1 and 500 characters')
    .matches(/^[a-zA-Z0-9/-_.]+$/)
    .withMessage('File path contains invalid characters')
    .escape(),
  body('contentType')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Content type must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9/-_.]+$/)
    .withMessage('Content type contains invalid characters')
    .escape(),
  body('expiresIn')
    .optional()
    .isInt({ min: 300, max: 86400 })
    .withMessage('Expiration time must be between 300 and 86400 seconds (5 minutes to 24 hours)'),
];

// Generate download URL validation
const generateDownloadUrlValidation = [
  body('filePath')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('File path must be between 1 and 500 characters')
    .matches(/^[a-zA-Z0-9/-_.]+$/)
    .withMessage('File path contains invalid characters')
    .escape(),
  body('expiresIn')
    .optional()
    .isInt({ min: 300, max: 86400 })
    .withMessage('Expiration time must be between 300 and 86400 seconds (5 minutes to 24 hours)'),
];

// Delete file validation
const deleteFileValidation = [
  param('filePath')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('File path must be between 1 and 500 characters')
    .matches(/^[a-zA-Z0-9/-_.]+$/)
    .withMessage('File path contains invalid characters')
    .escape(),
];

// Get file metadata validation
const getFileMetadataValidation = [
  param('filePath')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('File path must be between 1 and 500 characters')
    .matches(/^[a-zA-Z0-9/-_.]+$/)
    .withMessage('File path contains invalid characters')
    .escape(),
];

// Check file exists validation
const checkFileExistsValidation = [
  query('filePath')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('File path must be between 1 and 500 characters')
    .matches(/^[a-zA-Z0-9/-_.]+$/)
    .withMessage('File path contains invalid characters')
    .escape(),
];

// Get file size validation
const getFileSizeValidation = [
  query('filePath')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('File path must be between 1 and 500 characters')
    .matches(/^[a-zA-Z0-9/-_.]+$/)
    .withMessage('File path contains invalid characters')
    .escape(),
];

// List files validation
const listFilesValidation = [
  query('directory')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Directory path must be between 1 and 500 characters')
    .matches(/^[a-zA-Z0-9/-_.]+$/)
    .withMessage('Directory path contains invalid characters')
    .escape(),
  query('maxResults')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Max results must be between 1 and 1000'),
  query('pageToken').optional().isString().withMessage('Page token must be a string'),
];

/**
 * Validation middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array(),
    });
  }
  next();
}

module.exports = {
  generateUploadUrlValidation,
  generateDownloadUrlValidation,
  deleteFileValidation,
  getFileMetadataValidation,
  checkFileExistsValidation,
  getFileSizeValidation,
  listFilesValidation,
  validate,
};
