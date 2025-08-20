const { verifyIdToken, getUserCustomClaims } = require('../../lib/firebase');
const { createRequestLogger } = require('../lib/logger');

/**
 * Middleware to verify Firebase ID token and authenticate user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'AUTH_MISSING_TOKEN',
          message: 'Authorization header is required',
        },
      });
    }

    // Extract token from "Bearer <token>" format
    const tokenParts = authHeader.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'AUTH_INVALID_FORMAT',
          message: 'Authorization header must be in format: Bearer <token>',
        },
      });
    }

    const idToken = tokenParts[1];
    const logger = createRequestLogger(req.id);

    try {
      // Verify the Firebase ID token
      const decodedToken = await verifyIdToken(idToken);

      // Get user custom claims for authorization
      const customClaims = await getUserCustomClaims(decodedToken.uid);

      // Attach user information to request object
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        phoneNumber: decodedToken.phone_number,
        customClaims,
        // Include token metadata for logging
        tokenIssuedAt: decodedToken.iat,
        tokenExpiresAt: decodedToken.exp,
      };

      logger.debug('User authenticated successfully', {
        uid: req.user.uid,
        email: req.user.email,
        hasCustomClaims: Object.keys(customClaims).length > 0,
      });

      next();
    } catch (tokenError) {
      logger.warn('Token verification failed', {
        error: tokenError.message,
        code: tokenError.code,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Handle specific Firebase Auth errors
      let errorCode = 'AUTH_INVALID_TOKEN';
      let errorMessage = 'Invalid or expired token';

      if (tokenError.code === 'auth/id-token-expired') {
        errorCode = 'AUTH_TOKEN_EXPIRED';
        errorMessage = 'Token has expired';
      } else if (tokenError.code === 'auth/id-token-revoked') {
        errorCode = 'AUTH_TOKEN_REVOKED';
        errorMessage = 'Token has been revoked';
      } else if (tokenError.code === 'auth/user-not-found') {
        errorCode = 'AUTH_USER_NOT_FOUND';
        errorMessage = 'User account not found';
      } else if (tokenError.code === 'auth/user-disabled') {
        errorCode = 'AUTH_USER_DISABLED';
        errorMessage = 'User account has been disabled';
      }

      return res.status(401).json({
        ok: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      });
    }
  } catch (error) {
    const logger = createRequestLogger(req.id);
    logger.error('Authentication middleware error', {
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      ok: false,
      error: {
        code: 'AUTH_INTERNAL_ERROR',
        message: 'Internal authentication error',
      },
    });
  }
}

/**
 * Middleware to check if user has required role
 * @param {string|Array} requiredRoles - Required role(s)
 * @returns {Function} Express middleware function
 */
function requireRole(requiredRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required',
        },
      });
    }

    const userRole = req.user.customClaims?.role || 'user';
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    if (!roles.includes(userRole)) {
      const logger = createRequestLogger(req.id);
      logger.warn('Access denied - insufficient role', {
        uid: req.user.uid,
        userRole,
        requiredRoles: roles,
        endpoint: req.originalUrl,
      });

      return res.status(403).json({
        ok: false,
        error: {
          code: 'AUTH_INSUFFICIENT_ROLE',
          message: 'Insufficient permissions for this operation',
        },
      });
    }

    next();
  };
}

/**
 * Middleware to check if user has required verification status
 * @param {string|Array} requiredStatuses - Required verification status(es)
 * @returns {Function} Express middleware function
 */
function requireVerification(requiredStatuses) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required',
        },
      });
    }

    const userStatus = req.user.customClaims?.gv || 'pending';
    const statuses = Array.isArray(requiredStatuses) ? requiredStatuses : [requiredStatuses];

    if (!statuses.includes(userStatus)) {
      const logger = createRequestLogger(req.id);
      logger.warn('Access denied - insufficient verification status', {
        uid: req.user.uid,
        userStatus,
        requiredStatuses: statuses,
        endpoint: req.originalUrl,
      });

      return res.status(403).json({
        ok: false,
        error: {
          code: 'AUTH_INSUFFICIENT_VERIFICATION',
          message: 'Account verification required for this operation',
        },
      });
    }

    next();
  };
}

/**
 * Optional authentication middleware - doesn't fail if no token provided
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // No token provided, continue without authentication
    return next();
  }

  try {
    // Try to authenticate, but don't fail if token is invalid
    const tokenParts = authHeader.split(' ');
    if (tokenParts.length === 2 && tokenParts[0] === 'Bearer') {
      const idToken = tokenParts[1];
      const decodedToken = await verifyIdToken(idToken);
      const customClaims = await getUserCustomClaims(decodedToken.uid);

      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        phoneNumber: decodedToken.phone_number,
        customClaims,
      };
    }
  } catch (error) {
    // Token is invalid, but we don't fail the request
    // Just continue without setting req.user
  }

  next();
}

module.exports = {
  authenticateToken,
  requireRole,
  requireVerification,
  optionalAuth,
};
