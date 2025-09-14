const { v4: uuidv4 } = require('uuid');
const { redisClient } = require('./rateLimit');
const { config } = require('../config');
const { createModuleLogger } = require('../lib/logger');
const logger = createModuleLogger('idempotency');

/**
 * Idempotency middleware for destructive admin actions
 * Ensures that operations can be safely retried without side effects
 */

/**
 * Generate a unique idempotency key
 * @returns {string} Unique idempotency key
 */
function generateIdempotencyKey() {
  return `idempotency:${uuidv4()}`;
}

/**
 * Check if an idempotency key has been used
 * @param {string} key - Idempotency key to check
 * @returns {Promise<Object|null>} Previous response if key exists, null otherwise
 */
async function checkIdempotencyKey(key) {
  if (!redisClient || !config.redis?.enabled) {
    return null;
  }

  try {
    const stored = await redisClient.get(key);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch (error) {
    logger.error('Failed to check idempotency key', { error: error.message, key });
    return null;
  }
}

/**
 * Store idempotency key with response
 * @param {string} key - Idempotency key
 * @param {Object} response - Response to store
 * @param {number} ttl - Time to live in seconds (default: 24 hours)
 * @returns {Promise<boolean>} Success status
 */
async function storeIdempotencyKey(key, response, ttl = 24 * 60 * 60) {
  if (!redisClient || !config.redis?.enabled) {
    return false;
  }

  try {
    await redisClient.setex(key, ttl, JSON.stringify(response));
    logger.debug('Idempotency key stored', { key, ttl });
    return true;
  } catch (error) {
    logger.error('Failed to store idempotency key', { error: error.message, key });
    return false;
  }
}

/**
 * Create idempotency middleware
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware
 */
function createIdempotencyMiddleware(options = {}) {
  const {
    headerName = 'X-Idempotency-Key',
    ttl = 24 * 60 * 60, // 24 hours
    required = true,
    methods = ['POST', 'PUT', 'PATCH', 'DELETE'],
    skipSuccessfulRequests = false
  } = options;

  return async (req, res, next) => {
    // Only apply to specified methods
    if (!methods.includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.get(headerName);

    // If key is required but not provided
    if (required && !idempotencyKey) {
      logger.warn('Idempotency key required but not provided', {
        path: req.path,
        method: req.method,
        userId: req.user?.uid
      });

      return res.status(400).json({
        ok: false,
        error: {
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'Idempotency key is required for this operation',
          headerName
        }
      });
    }

    // If no key provided and not required, continue
    if (!idempotencyKey) {
      return next();
    }

    // Validate key format
    if (!/^[a-zA-Z0-9_-]+$/.test(idempotencyKey)) {
      logger.warn('Invalid idempotency key format', {
        path: req.path,
        method: req.method,
        userId: req.user?.uid,
        key: idempotencyKey
      });

      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_IDEMPOTENCY_KEY',
          message: 'Invalid idempotency key format'
        }
      });
    }

    // Check if key has been used before
    const previousResponse = await checkIdempotencyKey(idempotencyKey);
    
    if (previousResponse) {
      logger.info('Idempotency key reused, returning previous response', {
        path: req.path,
        method: req.method,
        userId: req.user?.uid,
        key: idempotencyKey
      });

      // Return the previous response
      res.status(previousResponse.statusCode || 200).json(previousResponse.body);
      return;
    }

    // Store original response methods
    const originalJson = res.json;
    const originalStatus = res.status;
    const originalEnd = res.end;

    let responseBody = null;
    let responseStatus = 200;

    // Override res.json to capture response
    res.json = function(body) {
      responseBody = body;
      return originalJson.call(this, body);
    };

    // Override res.status to capture status
    res.status = function(statusCode) {
      responseStatus = statusCode;
      return originalStatus.call(this, statusCode);
    };

    // Override res.end to store idempotency key
    res.end = async function(chunk, encoding) {
      // Only store successful responses if skipSuccessfulRequests is false
      if (!skipSuccessfulRequests || responseStatus >= 400) {
        try {
          await storeIdempotencyKey(idempotencyKey, {
            statusCode: responseStatus,
            body: responseBody,
            timestamp: new Date().toISOString(),
            path: req.path,
            method: req.method,
            userId: req.user?.uid
          }, ttl);
        } catch (error) {
          logger.error('Failed to store idempotency response', {
            error: error.message,
            key: idempotencyKey
          });
        }
      }

      // Call original end method
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

/**
 * Generate and return an idempotency key
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function generateIdempotencyKeyEndpoint(req, res) {
  const key = generateIdempotencyKey();
  
  logger.info('Idempotency key generated', {
    userId: req.user?.uid,
    key
  });

  res.status(200).json({
    ok: true,
    data: {
      idempotencyKey: key,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }
  });
}

/**
 * Check idempotency key status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function checkIdempotencyKeyStatus(req, res) {
  const { key } = req.params;

  if (!key) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'KEY_REQUIRED',
        message: 'Idempotency key is required'
      }
    });
  }

  try {
    const status = await checkIdempotencyKey(key);
    
    if (status) {
      res.status(200).json({
        ok: true,
        data: {
          used: true,
          response: status,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      });
    } else {
      res.status(200).json({
        ok: true,
        data: {
          used: false,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      });
    }
  } catch (error) {
    logger.error('Failed to check idempotency key status', { error: error.message, key });
    res.status(500).json({
      ok: false,
      error: {
        code: 'CHECK_FAILED',
        message: 'Failed to check idempotency key status'
      }
    });
  }
}

/**
 * Clear idempotency key (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function clearIdempotencyKey(req, res) {
  const { key } = req.params;

  if (!key) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'KEY_REQUIRED',
        message: 'Idempotency key is required'
      }
    });
  }

  try {
    if (redisClient && config.redis?.enabled) {
      await redisClient.del(`idempotency:${key}`);
      logger.info('Idempotency key cleared', { key, userId: req.user?.uid });
      
      res.status(200).json({
        ok: true,
        data: {
          message: 'Idempotency key cleared successfully'
        }
      });
    } else {
      res.status(400).json({
        ok: false,
        error: {
          code: 'REDIS_NOT_AVAILABLE',
          message: 'Redis is not available for key management'
        }
      });
    }
  } catch (error) {
    logger.error('Failed to clear idempotency key', { error: error.message, key });
    res.status(500).json({
      ok: false,
      error: {
        code: 'CLEAR_FAILED',
        message: 'Failed to clear idempotency key'
      }
    });
  }
}

// Default idempotency middleware for destructive admin actions
const adminIdempotency = createIdempotencyMiddleware({
  required: true,
  methods: ['DELETE', 'PUT', 'PATCH'],
  ttl: 24 * 60 * 60, // 24 hours
  skipSuccessfulRequests: false
});

// Optional idempotency middleware for other operations
const optionalIdempotency = createIdempotencyMiddleware({
  required: false,
  methods: ['POST', 'PUT', 'PATCH'],
  ttl: 24 * 60 * 60, // 24 hours
  skipSuccessfulRequests: true
});

module.exports = {
  createIdempotencyMiddleware,
  adminIdempotency,
  optionalIdempotency,
  generateIdempotencyKey,
  checkIdempotencyKey,
  storeIdempotencyKey,
  generateIdempotencyKeyEndpoint,
  checkIdempotencyKeyStatus,
  clearIdempotencyKey
};

