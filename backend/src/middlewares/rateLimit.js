const rateLimit = require('express-rate-limit');
const { config } = require('../config');
const { createRequestLogger } = require('../lib/logger');

/**
 * Create a rate limiter with specified options
 * @param {Object} options - Rate limiter options
 * @returns {Function} Express middleware function
 */
function createRateLimiter(options) {
  const {
    windowMs = config.rateLimit.windowMs,
    max = config.rateLimit.maxRequests,
    message = 'Too many requests from this IP, please try again later.',
    standardHeaders = true,
    legacyHeaders = false,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = (req) => req.ip,
    handler = (req, res) => {
      const logger = createRequestLogger(req.id);
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.uid,
        endpoint: req.originalUrl,
      });

      res.status(429).json({
        ok: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
        },
      });
    },
  } = options;

  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders,
    legacyHeaders,
    skipSuccessfulRequests,
    skipFailedRequests,
    keyGenerator,
    handler,
  });
}

/**
 * General rate limiter for all endpoints
 */
const generalRateLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  skipSuccessfulRequests: true, // Only count failed requests
});

/**
 * Strict rate limiter for authentication endpoints
 */
const authRateLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMaxRequests,
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: false, // Count all requests for auth endpoints
  keyGenerator: (req) => {
    // Use IP + user agent for more granular rate limiting on auth
    return `${req.ip}-${req.get('User-Agent') || 'unknown'}`;
  },
});



/**
 * Rate limiter for password reset endpoints
 */
const passwordResetRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Maximum 3 password reset attempts per hour per IP
  message: 'Too many password reset attempts, please try again later.',
  keyGenerator: (req) => req.ip,
});



/**
 * Rate limiter for email verification endpoints
 */
const emailVerificationRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Maximum 5 email verification requests per hour per email
  message: 'Too many email verification requests, please try again later.',
  keyGenerator: (req) => {
    // Use email if available, otherwise fall back to IP
    const email = req.body?.email;
    return email || req.ip;
  },
});

/**
 * Dynamic rate limiter based on user authentication status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function dynamicRateLimiter(req, res, next) {
  // If user is authenticated, use more lenient limits
  if (req.user) {
    // Authenticated users get higher limits
    const userLimiter = createRateLimiter({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests * 2, // Double the limit for authenticated users
      keyGenerator: (req) => req.user.uid, // Rate limit per user instead of per IP
      message: 'Too many requests from this account, please try again later.',
    });
    
    return userLimiter(req, res, next);
  }
  
  // Unauthenticated users get standard limits
  return generalRateLimiter(req, res, next);
}

/**
 * Rate limiter for admin endpoints
 */
const adminRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Maximum 30 admin requests per minute per IP
  message: 'Too many admin requests, please try again later.',
  keyGenerator: (req) => req.ip,
});

module.exports = {
  createRateLimiter,
  generalRateLimiter,
  authRateLimiter,
  passwordResetRateLimiter,
  emailVerificationRateLimiter,
  dynamicRateLimiter,
  adminRateLimiter,
};
