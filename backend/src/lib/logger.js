const winston = require('winston');
const { config } = require('../config');

/**
 * Custom format for development logging
 */
const devFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

/**
 * JSON format for production logging
 */
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Create logger instance based on environment
 */
function createLogger() {
  const transports = [];

  // Determine logging target: console | file | gcp
  const target = config.logging.target || 'console';

  if (target === 'gcp') {
    try {
      const { CloudLoggingWinston } = require('winston-cloud-logging');
      transports.push(
        new CloudLoggingWinston({
          logName: 'matcha-backend',
          projectId: config.firebase.projectId,
          resource: {
            type: 'cloud_run_revision',
            labels: {
              service_name: 'matcha-backend',
              revision_name: process.env.K_REVISION || 'unknown',
            },
          },
        })
      );
    } catch (error) {
      console.warn('Cloud Logging transport not available, falling back to console');
      transports.push(new winston.transports.Console());
    }
  } else if (target === 'file') {
    transports.push(new winston.transports.File({ filename: config.logging.filePath }));
  } else {
    transports.push(new winston.transports.Console());
  }

  return winston.createLogger({
    level: config.logging.level,
    format: config.isProduction ? prodFormat : devFormat,
    transports,
    // Handle uncaught exceptions and unhandled rejections
    exceptionHandlers: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
      }),
    ],
    rejectionHandlers: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
      }),
    ],
  });
}

/**
 * Create request logger with request ID
 * @param {string} requestId - Unique request identifier
 * @returns {winston.Logger} Logger instance with request context
 */
function createRequestLogger(requestId) {
  const logger = createLogger();
  
  // Add request context to all log messages
  const requestLogger = {
    info: (message, meta = {}) => logger.info(message, { ...meta, requestId }),
    error: (message, meta = {}) => logger.error(message, { ...meta, requestId }),
    warn: (message, meta = {}) => logger.warn(message, { ...meta, requestId }),
    debug: (message, meta = {}) => logger.debug(message, { ...meta, requestId }),
    log: (level, message, meta = {}) => logger.log(level, message, { ...meta, requestId }),
  };

  return requestLogger;
}

/**
 * Redact sensitive information from log messages
 * @param {any} data - Data to redact
 * @returns {any} Redacted data
 */
function redactSensitiveData(data) {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'authToken',
    'refreshToken',
    'idToken',
    'accessToken',
    'privateKey',
    'credential',
  ];

  const redacted = { ...data };

  for (const field of sensitiveFields) {
    if (redacted[field]) {
      redacted[field] = '[REDACTED]';
    }
  }

  // Recursively redact nested objects
  for (const key in redacted) {
    if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactSensitiveData(redacted[key]);
    }
  }

  return redacted;
}

/**
 * Log HTTP request details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function logRequest(req, res, next) {
  const startTime = Date.now();
  const requestId = req.id || 'unknown';

  // Log request start
  const logger = createRequestLogger(requestId);
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.uid,
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    logger.info('HTTP Response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.uid,
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
}

/**
 * Log error with context
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 * @param {string} requestId - Request ID for correlation
 */
function logError(error, context = {}, requestId = null) {
  const logger = requestId ? createRequestLogger(requestId) : createLogger();
  
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code,
    ...redactSensitiveData(context),
  });
}

module.exports = {
  createLogger,
  createRequestLogger,
  redactSensitiveData,
  logRequest,
  logError,
};
