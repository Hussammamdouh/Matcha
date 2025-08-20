const { createRequestLogger } = require('../lib/logger');

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create application error with specific code
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 * @returns {AppError} Application error instance
 */
function createError(message, statusCode = 500, code = 'INTERNAL_ERROR') {
  return new AppError(message, statusCode, code);
}

/**
 * Common error codes and their corresponding HTTP status codes
 */
const ErrorCodes = {
  // Authentication errors (4xx)
  AUTH_MISSING_TOKEN: { statusCode: 401, message: 'Authorization token is required' },
  AUTH_INVALID_TOKEN: { statusCode: 401, message: 'Invalid or expired token' },
  AUTH_TOKEN_EXPIRED: { statusCode: 401, message: 'Token has expired' },
  AUTH_TOKEN_REVOKED: { statusCode: 401, message: 'Token has been revoked' },
  AUTH_USER_NOT_FOUND: { statusCode: 401, message: 'User account not found' },
  AUTH_USER_DISABLED: { statusCode: 401, message: 'User account has been disabled' },
  AUTH_INSUFFICIENT_ROLE: { statusCode: 403, message: 'Insufficient permissions' },
  AUTH_INSUFFICIENT_VERIFICATION: { statusCode: 403, message: 'Account verification required' },
  AUTH_INVALID_CREDENTIALS: { statusCode: 401, message: 'Invalid credentials' },
  AUTH_ACCOUNT_LOCKED: { statusCode: 423, message: 'Account is temporarily locked' },

  // Validation errors (4xx)
  VALIDATION_ERROR: { statusCode: 400, message: 'Validation failed' },
  INVALID_EMAIL: { statusCode: 400, message: 'Invalid email format' },
  INVALID_PHONE: { statusCode: 400, message: 'Invalid phone number format' },
  INVALID_PASSWORD: { statusCode: 400, message: 'Password does not meet requirements' },
  INVALID_NICKNAME: { statusCode: 400, message: 'Invalid nickname format' },
  DUPLICATE_NICKNAME: { statusCode: 409, message: 'Nickname already taken' },
  DUPLICATE_EMAIL: { statusCode: 409, message: 'Email already registered' },
  DUPLICATE_PHONE: { statusCode: 409, message: 'Phone number already registered' },

  // Rate limiting errors (4xx)
  RATE_LIMIT_EXCEEDED: { statusCode: 429, message: 'Too many requests' },

  // File upload errors (4xx)
  FILE_UPLOAD_ERROR: { statusCode: 400, message: 'File upload failed' },
  FILE_TOO_LARGE: { statusCode: 400, message: 'File size exceeds limit' },
  INVALID_FILE_TYPE: { statusCode: 400, message: 'Invalid file type' },

  // Resource errors (4xx)
  RESOURCE_NOT_FOUND: { statusCode: 404, message: 'Resource not found' },
  RESOURCE_ALREADY_EXISTS: { statusCode: 409, message: 'Resource already exists' },
  RESOURCE_ACCESS_DENIED: { statusCode: 403, message: 'Access to resource denied' },

  // Server errors (5xx)
  INTERNAL_ERROR: { statusCode: 500, message: 'Internal server error' },
  DATABASE_ERROR: { statusCode: 500, message: 'Database operation failed' },
  EXTERNAL_SERVICE_ERROR: { statusCode: 502, message: 'External service unavailable' },
  FIREBASE_ERROR: { statusCode: 500, message: 'Firebase operation failed' },
  STORAGE_ERROR: { statusCode: 500, message: 'File storage operation failed' },
};

/**
 * Get error details by code
 * @param {string} code - Error code
 * @returns {Object} Error details
 */
function getErrorDetails(code) {
  return ErrorCodes[code] || ErrorCodes.INTERNAL_ERROR;
}

/**
 * Error handling middleware
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(error, req, res, next) {
  const requestId = req.id || 'unknown';
  const logger = createRequestLogger(requestId);

  // Log the error
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    code: error.code,
    statusCode: error.statusCode,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.uid,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Determine error details
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'Internal server error';

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
  } else if (error.code && ErrorCodes[error.code]) {
    const errorDetails = ErrorCodes[error.code];
    statusCode = errorDetails.statusCode;
    errorCode = error.code;
    message = errorDetails.message;
  } else if (error.statusCode) {
    statusCode = error.statusCode;
    message = error.message || 'An error occurred';
  }

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Invalid data format';
  } else if (error.code === 'ENOTFOUND') {
    statusCode = 502;
    errorCode = 'EXTERNAL_SERVICE_ERROR';
    message = 'External service unavailable';
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
  }

  // Send error response
  res.status(statusCode).json({
    ok: false,
    error: {
      code: errorCode,
      message,
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message,
        stack: error.stack,
      }),
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * 404 handler for unmatched routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function notFoundHandler(req, res) {
  const requestId = req.id || 'unknown';

  res.status(404).json({
    ok: false,
    error: {
      code: 'RESOURCE_NOT_FOUND',
      message: 'Endpoint not found',
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method,
    },
  });
}

/**
 * Async error wrapper for route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function that catches async errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  createError,
  ErrorCodes,
  getErrorDetails,
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
