const pino = require('pino');
const { config } = require('../config');

// Fields that should be redacted from logs
const REDACTED_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'cookie',
  'session',
  'creditCard',
  'ssn',
  'phone',
  'email',
  'address',
  'ip',
  'userAgent',
  'fingerprint',
  'deviceId',
  'firebaseToken',
  'idToken',
  'refreshToken',
  'apiKey',
  'privateKey',
  'clientSecret'
];

// Create redaction function
function redactSensitiveData(obj, path = '') {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) => redactSensitiveData(item, `${path}[${index}]`));
  }

  const redacted = {};
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (REDACTED_FIELDS.some(field => 
      key.toLowerCase().includes(field.toLowerCase()) ||
      currentPath.toLowerCase().includes(field.toLowerCase())
    )) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value, currentPath);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

// Create Pino logger instance
const logger = pino({
  level: config.logLevel || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
    log: (object) => {
      // Redact sensitive data from all log objects
      return redactSensitiveData(object);
    }
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      headers: redactSensitiveData(req.headers),
      query: redactSensitiveData(req.query),
      body: redactSensitiveData(req.body),
      ip: '[REDACTED]',
      userAgent: '[REDACTED]'
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: redactSensitiveData(res.getHeaders())
    }),
    err: (err) => ({
      type: err.type,
      message: err.message,
      stack: err.stack,
      code: err.code,
      statusCode: err.statusCode
    })
  },
  transport: config.isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined
});

// Create request-specific logger
function createRequestLogger(requestId) {
  return logger.child({ requestId });
}

// Create module-specific logger
function createModuleLogger(moduleName) {
  return logger.child({ module: moduleName });
}

// Create operation-specific logger with tracing
function createOperationLogger(operation, context = {}) {
  return logger.child({ 
    operation,
    traceId: context.traceId,
    spanId: context.spanId,
    ...context
  });
}

// Log request with redaction
function logRequest(req, res, next) {
  const startTime = Date.now();
  
  // Create request logger
  const requestLogger = createRequestLogger(req.id);
  
  // Log request start
  requestLogger.info('Request started', {
    method: req.method,
    url: req.originalUrl,
    userAgent: '[REDACTED]',
    ip: '[REDACTED]',
    userId: req.user?.uid || 'anonymous'
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    requestLogger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.uid || 'anonymous'
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
}

// Log error with context
function logError(error, context = {}) {
  const errorLogger = logger.child(context);
  
  errorLogger.error('Error occurred', {
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode
    },
    context
  });
}

// Log security event
function logSecurityEvent(event, details, context = {}) {
  const securityLogger = logger.child({ 
    category: 'security',
    ...context 
  });
  
  securityLogger.warn('Security event', {
    event,
    details: redactSensitiveData(details),
    context
  });
}

// Log performance metrics
function logPerformance(operation, duration, context = {}) {
  const perfLogger = logger.child({ 
    category: 'performance',
    ...context 
  });
  
  perfLogger.info('Performance metric', {
    operation,
    duration: `${duration}ms`,
    context
  });
}

// Log database operation
function logDatabaseOperation(operation, collection, documentId, context = {}) {
  const dbLogger = logger.child({ 
    category: 'database',
    ...context 
  });
  
  dbLogger.debug('Database operation', {
    operation,
    collection,
    documentId,
    context
  });
}

// Log storage operation
function logStorageOperation(operation, bucket, path, context = {}) {
  const storageLogger = logger.child({ 
    category: 'storage',
    ...context 
  });
  
  storageLogger.debug('Storage operation', {
    operation,
    bucket,
    path,
    context
  });
}

// Log rate limiting event
function logRateLimitEvent(ip, endpoint, userId, context = {}) {
  const rateLimitLogger = logger.child({ 
    category: 'rateLimit',
    ...context 
  });
  
  rateLimitLogger.warn('Rate limit exceeded', {
    ip: '[REDACTED]',
    endpoint,
    userId: userId || 'anonymous',
    context
  });
}

// Log authentication event
function logAuthEvent(event, userId, success, context = {}) {
  const authLogger = logger.child({ 
    category: 'authentication',
    ...context 
  });
  
  const level = success ? 'info' : 'warn';
  authLogger[level]('Authentication event', {
    event,
    userId,
    success,
    context
  });
}

// Log moderation action
function logModerationAction(action, targetType, targetId, moderatorId, details, context = {}) {
  const modLogger = logger.child({ 
    category: 'moderation',
    ...context 
  });
  
  modLogger.info('Moderation action', {
    action,
    targetType,
    targetId,
    moderatorId,
    details: redactSensitiveData(details),
    context
  });
}

// Log feature flag usage
function logFeatureFlag(flag, userId, enabled, context = {}) {
  const flagLogger = logger.child({ 
    category: 'featureFlag',
    ...context 
  });
  
  flagLogger.debug('Feature flag accessed', {
    flag,
    userId,
    enabled,
    context
  });
}

// Export logger functions
module.exports = {
  logger,
  createRequestLogger,
  createModuleLogger,
  createOperationLogger,
  logRequest,
  logError,
  logSecurityEvent,
  logPerformance,
  logDatabaseOperation,
  logStorageOperation,
  logRateLimitEvent,
  logAuthEvent,
  logModerationAction,
  logFeatureFlag,
  redactSensitiveData
};
