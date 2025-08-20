const { getAuth } = require('../../lib/firebase');
const { createRequestLogger } = require('../lib/logger');

/**
 * Verify Firebase ID token from Authorization header
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function verifyFirebaseIdToken(req, res, next) {
  const logger = createRequestLogger(req.id);

  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'AUTH_MISSING_TOKEN',
          message: 'Authorization header with Bearer token is required',
        },
        meta: {
          requestId: req.id,
        },
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'AUTH_INVALID_TOKEN',
          message: 'Invalid token format',
        },
        meta: {
          requestId: req.id,
        },
      });
    }

    // Verify the ID token with Firebase Admin
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);

    // Check if user is disabled
    if (decodedToken.disabled) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'AUTH_USER_DISABLED',
          message: 'User account has been disabled',
        },
        meta: {
          requestId: req.id,
        },
      });
    }

    // Check if email is verified (for protected operations)
    if (!decodedToken.email_verified && req.requireEmailVerification) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'AUTH_EMAIL_NOT_VERIFIED',
          message: 'Email verification required',
        },
        meta: {
          requestId: req.id,
        },
      });
    }

    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified || false,
      customClaims: decodedToken.custom_claims || {},
    };

    logger.info('Firebase ID token verified successfully', {
      userId: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      ip: req.ip,
    });

    next();
  } catch (error) {
    logger.warn('Firebase ID token verification failed', {
      error: error.message,
      code: error.code,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Handle specific Firebase auth errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'AUTH_TOKEN_EXPIRED',
          message: 'ID token has expired',
        },
        meta: {
          requestId: req.id,
        },
      });
    }

    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'AUTH_TOKEN_REVOKED',
          message: 'ID token has been revoked',
        },
        meta: {
          requestId: req.id,
        },
      });
    }

    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'AUTH_INVALID_TOKEN',
          message: 'Invalid ID token',
        },
        meta: {
          requestId: req.id,
        },
      });
    }

    // Generic auth error
    return res.status(401).json({
      ok: false,
      error: {
        code: 'AUTH_VERIFICATION_FAILED',
        message: 'Token verification failed',
      },
      meta: {
        requestId: req.id,
      },
    });
  }
}

/**
 * Middleware to require email verification for specific routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requireEmailVerification(req, res, next) {
  req.requireEmailVerification = true;
  next();
}

module.exports = {
  verifyFirebaseIdToken,
  requireEmailVerification,
};

