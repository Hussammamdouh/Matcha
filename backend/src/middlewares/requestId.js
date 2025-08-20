const { v4: uuidv4 } = require('uuid');

/**
 * Middleware to generate and attach a unique request ID to each request
 * This ID is used for logging, tracing, and debugging purposes
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requestIdMiddleware(req, res, next) {
  // Generate a unique request ID
  const requestId = uuidv4();

  // Attach to request object for use in other middleware and route handlers
  req.id = requestId;

  // Attach to response headers for client correlation
  res.set('X-Request-ID', requestId);

  // Add to response locals for use in error handlers
  res.locals.requestId = requestId;

  next();
}

module.exports = requestIdMiddleware;
