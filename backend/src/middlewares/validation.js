const { body, param, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const { features } = require('../config');
const { createModuleLogger } = require('../lib/logger');
const logger = createModuleLogger('validation');

/**
 * Sanitize HTML content with safe defaults
 * @param {string} html - HTML content to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized HTML
 */
function sanitizeHtmlContent(html, options = {}) {
  const defaultOptions = {
    allowedTags: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'
    ],
    allowedAttributes: {
      'a': ['href', 'title'],
      'img': ['src', 'alt', 'title'],
      'code': ['class'],
      'pre': ['class']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedClasses: {
      'code': ['language-*', 'hljs', 'highlight'],
      'pre': ['language-*', 'hljs', 'highlight']
    },
    transformTags: {
      'a': (tagName, attribs) => {
        // Ensure external links open in new tab
        if (attribs.href && attribs.href.startsWith('http')) {
          attribs.target = '_blank';
          attribs.rel = 'noopener noreferrer';
        }
        return { tagName, attribs };
      }
    }
  };

  const sanitizeOptions = { ...defaultOptions, ...options };
  return sanitizeHtml(html, sanitizeOptions);
}

/**
 * Sanitize plain text content
 * @param {string} text - Text content to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
  if (typeof text !== 'string') return text;
  
  return text
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate and sanitize request body
 * @param {Object} validations - Validation rules
 * @returns {Array} Express middleware array
 */
function validateBody(validations) {
  return [
    ...validations,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Validation failed', {
          path: req.path,
          method: req.method,
          errors: errors.array(),
          userId: req.user?.uid
        });
        
        return res.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: errors.array()
          }
        });
      }
      next();
    }
  ];
}

/**
 * Validate and sanitize request parameters
 * @param {Object} validations - Validation rules
 * @returns {Array} Express middleware array
 */
function validateParams(validations) {
  return [
    ...validations,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Parameter validation failed', {
          path: req.path,
          method: req.method,
          errors: errors.array(),
          userId: req.user?.uid
        });
        
        return res.status(400).json({
          ok: false,
          error: {
            code: 'PARAMETER_VALIDATION_ERROR',
            message: 'Parameter validation failed',
            details: errors.array()
          }
        });
      }
      next();
    }
  ];
}

/**
 * Validate and sanitize query parameters
 * @param {Object} validations - Validation rules
 * @returns {Array} Express middleware array
 */
function validateQuery(validations) {
  return [
    ...validations,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Query validation failed', {
          path: req.path,
          method: req.method,
          errors: errors.array(),
          userId: req.user?.uid
        });
        
        return res.status(400).json({
          ok: false,
          error: {
            code: 'QUERY_VALIDATION_ERROR',
            message: 'Query parameter validation failed',
            details: errors.array()
          }
        });
      }
      next();
    }
  ];
}

/**
 * Sanitize request body content
 * @param {Object} sanitizationRules - Fields to sanitize and how
 * @returns {Function} Express middleware
 */
function sanitizeBody(sanitizationRules) {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      for (const [field, rule] of Object.entries(sanitizationRules)) {
        if (req.body[field]) {
          switch (rule) {
            case 'html':
              req.body[field] = sanitizeHtmlContent(req.body[field]);
              break;
            case 'text':
              req.body[field] = sanitizeText(req.body[field]);
              break;
            case 'trim':
              req.body[field] = typeof req.body[field] === 'string' 
                ? req.body[field].trim() 
                : req.body[field];
              break;
            case 'lowercase':
              req.body[field] = typeof req.body[field] === 'string' 
                ? req.body[field].toLowerCase() 
                : req.body[field];
              break;
            case 'uppercase':
              req.body[field] = typeof req.body[field] === 'string' 
                ? req.body[field].toUpperCase() 
                : req.body[field];
              break;
          }
        }
      }
    }
    next();
  };
}

// Common validation rules
const commonValidations = {
  // ID validation
  id: param('id')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('ID must be alphanumeric with hyphens and underscores'),

  // UUID validation
  uuid: param('id')
    .isUUID(4)
    .withMessage('ID must be a valid UUID v4'),

  // Pagination validation
  pagination: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('cursor')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Cursor must be a valid string')
  ],

  // User ID validation
  userId: body('userId')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('User ID must be a valid string'),

  // Content validation
  content: body('content')
    .isString()
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10,000 characters'),

  // Title validation
  title: body('title')
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Title must be between 1 and 500 characters'),

  // Description validation
  description: body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 0, max: 2000 })
    .withMessage('Description must be less than 2,000 characters'),

  // Email validation
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),

  // Phone validation
  phone: body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Must be a valid phone number'),

  // URL validation
  url: body('url')
    .optional()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Must be a valid HTTP/HTTPS URL'),

  // File validation
  file: body('file')
    .optional()
    .isObject()
    .withMessage('File must be a valid object'),

  // Coordinates validation
  coordinates: [
    body('latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),
    body('longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180')
  ],

  // Date validation
  date: body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be in ISO 8601 format'),

  // Boolean validation
  boolean: body('enabled')
    .optional()
    .isBoolean()
    .withMessage('Must be a boolean value'),

  // Array validation
  array: (fieldName, minLength = 0, maxLength = 100) => 
    body(fieldName)
      .optional()
      .isArray({ min: minLength, max: maxLength })
      .withMessage(`${fieldName} must be an array with ${minLength}-${maxLength} items`),

  // Object validation
  object: (fieldName) => 
    body(fieldName)
      .optional()
      .isObject()
      .withMessage(`${fieldName} must be an object`),

  // Enum validation
  enum: (fieldName, allowedValues) => 
    body(fieldName)
      .isIn(allowedValues)
      .withMessage(`${fieldName} must be one of: ${allowedValues.join(', ')}`)
};

// Feature-specific validations
const featureValidations = {
  // KYC validation (if enabled)
  kyc: features.kyc ? [
    body('identityDocument')
      .isObject()
      .withMessage('Identity document is required'),
    body('identityDocument.type')
      .isIn(['passport', 'drivers_license', 'national_id'])
      .withMessage('Invalid identity document type'),
    body('identityDocument.number')
      .isString()
      .trim()
      .isLength({ min: 5, max: 50 })
      .withMessage('Identity document number is required')
  ] : [],

  // SMS validation (if enabled)
  sms: features.sms ? [
    body('phoneNumber')
      .isMobilePhone()
      .withMessage('Valid phone number is required for SMS verification')
  ] : [],

  // reCAPTCHA validation (if enabled)
  recaptcha: features.recaptcha ? [
    body('recaptchaToken')
      .isString()
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('reCAPTCHA token is required')
  ] : []
};

// Export validation functions and rules
module.exports = {
  validateBody,
  validateParams,
  validateQuery,
  sanitizeBody,
  sanitizeHtmlContent,
  sanitizeText,
  commonValidations,
  featureValidations,
  
  // Re-export express-validator for custom validations
  body,
  param,
  query,
  validationResult
};

