const rateLimit = require('express-rate-limit');
const { config } = require('../config');
const logger = require('../lib/logger');

// Redis removed; using in-memory store only
let redisClient = null;

/**
 * Create a rate limiter with Redis or in-memory storage
 * @param {Object} options - Rate limiter options
 * @returns {Object} Rate limiter instance
 */
function createRateLimiter(options) {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      ok: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000)
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Use a custom key generator that doesn't rely on trust proxy
    keyGenerator: (req) => {
      // Use X-Forwarded-For header if available, otherwise use connection remote address
      const forwarded = req.get('X-Forwarded-For');
      if (forwarded) {
        return forwarded.split(',')[0].trim();
      }
      return req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
    },
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        userId: req.user?.uid
      });
      
      res.status(429).json(options.message);
    }
  };

  const limiterOptions = { ...defaultOptions, ...options };
  
  // Always use in-memory store

  return rateLimit(limiterOptions);
}

/**
 * Create a daily quota limiter
 * @param {Object} options - Daily quota options
 * @returns {Object} Daily quota middleware
 */
function createDailyQuotaLimiter(options) {
  const {
    maxRequests = 1000,
    windowMs = 24 * 60 * 60 * 1000, // 24 hours
    keyGenerator = (req) => req.user?.uid || req.ip,
    message = {
      ok: false,
      error: {
        code: 'DAILY_QUOTA_EXCEEDED',
        message: 'Daily request quota exceeded. Please try again tomorrow.',
        retryAfter: 86400 // 24 hours in seconds
      }
    }
  } = options;

  return createRateLimiter({
    windowMs,
    max: maxRequests,
    keyGenerator,
    message,
    handler: (req, res) => {
      logger.warn('Daily quota exceeded', {
        key: keyGenerator(req),
        path: req.path,
        method: req.method,
        userId: req.user?.uid
      });
      
      res.status(429).json(message);
    }
  });
}

// General rate limiter for all routes
const generalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes
  message: {
    ok: false,
    error: {
      code: 'GENERAL_RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
      retryAfter: 900
    }
  }
});

// Auth-specific rate limiters
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 auth attempts per 15 minutes
  keyGenerator: (req) => req.ip,
  message: {
    ok: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.',
      retryAfter: 900
    }
  }
});

// Post creation rate limiter
const postCreationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 posts per hour
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: {
    ok: false,
    error: {
      code: 'POST_CREATION_LIMIT_EXCEEDED',
      message: 'Too many posts created, please wait before creating another.',
      retryAfter: 3600
    }
  }
});

// Comment creation rate limiter
const commentCreationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 comments per 15 minutes
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: {
    ok: false,
    error: {
      code: 'COMMENT_CREATION_LIMIT_EXCEEDED',
      message: 'Too many comments, please wait before commenting again.',
      retryAfter: 900
    }
  }
});

// Vote rate limiter
const voteLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 votes per 5 minutes
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: {
    ok: false,
    error: {
      code: 'VOTE_RATE_LIMIT_EXCEEDED',
      message: 'Too many votes, please wait before voting again.',
      retryAfter: 300
    }
  }
});

// Chat message rate limiter
const chatMessageLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: {
    ok: false,
    error: {
      code: 'CHAT_RATE_LIMIT_EXCEEDED',
      message: 'Too many messages, please slow down.',
      retryAfter: 60
    }
  }
});

// Men-review rate limiter
const menReviewLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 reviews per hour
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: {
    ok: false,
    error: {
      code: 'MEN_REVIEW_RATE_LIMIT_EXCEEDED',
      message: 'Too many reviews submitted, please wait before submitting another.',
      retryAfter: 3600
    }
  }
});

// Admin action rate limiter
const adminActionLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 admin actions per minute
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: {
    ok: false,
    error: {
      code: 'ADMIN_RATE_LIMIT_EXCEEDED',
      message: 'Too many admin actions, please slow down.',
      retryAfter: 60
    }
  }
});

// Report creation rate limiter
const reportCreationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 reports per hour
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: {
    ok: false,
    error: {
      code: 'REPORT_RATE_LIMIT_EXCEEDED',
      message: 'Too many reports submitted, please wait before submitting another.',
      retryAfter: 3600
    }
  }
});

// Additional rate limiters for auth operations
const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour
  keyGenerator: (req) => req.body?.email || req.ip,
  message: {
    ok: false,
    error: {
      code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset attempts, please wait before trying again.',
      retryAfter: 3600
    }
  }
});

const emailVerificationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 email verification attempts per hour
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: {
    ok: false,
    error: {
      code: 'EMAIL_VERIFICATION_RATE_LIMIT_EXCEEDED',
      message: 'Too many email verification attempts, please wait before trying again.',
      retryAfter: 3600
    }
  }
});

// Daily quota limiters
const postDailyQuota = createDailyQuotaLimiter({
  maxRequests: 50, // 50 posts per day
  keyGenerator: (req) => req.user?.uid || req.ip
});

const commentDailyQuota = createDailyQuotaLimiter({
  maxRequests: 200, // 200 comments per day
  keyGenerator: (req) => req.user?.uid || req.ip
});

const voteDailyQuota = createDailyQuotaLimiter({
  maxRequests: 500, // 500 votes per day
  keyGenerator: (req) => req.user?.uid || req.ip
});

const chatDailyQuota = createDailyQuotaLimiter({
  maxRequests: 1000, // 1000 chat messages per day
  keyGenerator: (req) => req.user?.uid || req.ip
});

const menReviewDailyQuota = createDailyQuotaLimiter({
  maxRequests: 20, // 20 men reviews per day
  keyGenerator: (req) => req.user?.uid || req.ip
});

/**
 * Get rate limit info for a specific key
 * @param {string} key - Rate limit key
 * @returns {Promise<Object>} Rate limit information
 */
async function getRateLimitInfo(key) {
  return { remaining: 'unknown', resetTime: 'unknown' };
}

/**
 * Reset rate limit for a specific key (admin only)
 * @param {string} key - Rate limit key
 * @returns {Promise<boolean>} Success status
 */
async function resetRateLimit(key) {
  return false;
}

module.exports = {
  // Rate limiters
  generalRateLimiter,
  authRateLimiter,
  postCreationLimiter,
  commentCreationLimiter,
  voteLimiter,
  chatMessageLimiter,
  menReviewLimiter,
  adminActionLimiter,
  reportCreationLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  
  // Daily quota limiters
  postDailyQuota,
  commentDailyQuota,
  voteDailyQuota,
  chatDailyQuota,
  menReviewDailyQuota,
  
  // Utility functions
  createRateLimiter,
  createDailyQuotaLimiter,
  getRateLimitInfo,
  resetRateLimit,
  
  // Redis client for external access
  redisClient
};
