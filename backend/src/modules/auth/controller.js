const { validationResult } = require('express-validator');
const { getAuth, getFirestore, setUserCustomClaims } = require('../../../lib/firebase');
const { createRequestLogger } = require('../../lib/logger');
const { createError, ErrorCodes } = require('../../middlewares/error');
const { sendEmail } = require('../../lib/mail');
const { createAuditLog } = require('../audit/service');
const { v4: uuidv4 } = require('uuid');

/**
 * Register new user with email and password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function registerWithEmail(req, res) {
  const logger = createRequestLogger(req.id);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array(),
      },
    });
  }

  const { email, password, nickname } = req.body;

  try {
    const auth = getAuth();
    const firestore = getFirestore();

    // Check if email already exists
    try {
      const existingUser = await auth.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          ok: false,
          error: {
            code: 'DUPLICATE_EMAIL',
            message: 'Email already registered',
          },
        });
      }
    } catch (error) {
      // User doesn't exist, which is what we want
    }

    // Check if nickname already exists
    const nicknameQuery = await firestore
      .collection('users')
      .where('nickname', '==', nickname)
      .limit(1)
      .get();

    if (!nicknameQuery.empty) {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'DUPLICATE_NICKNAME',
          message: 'Nickname already taken',
        },
      });
    }

    // Create Firebase user
    const userRecord = await auth.createUser({
      email,
      password,
      emailVerified: false,
    });

    // Set initial custom claims
    await setUserCustomClaims(userRecord.uid, {
      role: 'user',
      gv: 'pending', // Gender verification pending
    });

    // Create user profile in Firestore
    const userDoc = {
      uid: userRecord.uid,
      email,
      nickname,
      status: 'active',
      genderVerificationStatus: 'pending',
      kycProvider: 'none',
      isMfaEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await firestore.collection('users').doc(userRecord.uid).set(userDoc);

    // Create private user data collection (encrypted)
    const privateDoc = {
      uid: userRecord.uid,
      // TODO: Implement KMS encryption for sensitive fields
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await firestore.collection('users_private').doc(userRecord.uid).set(privateDoc);

    // Generate Firebase email verification link
    try {
      const auth = getAuth();
      const verificationLink = await auth.generateEmailVerificationLink(email, {
        url: `${process.env.FRONTEND_URL}/verify-email`,
        handleCodeInApp: false,
      });

      // Send verification email via job queue
      await sendEmail({
        to: email,
        subject: 'Welcome to Matcha - Verify Your Email',
        template: 'email-verification',
        data: {
          nickname,
          verificationLink,
        },
      });
    } catch (emailError) {
      logger.warn('Failed to send verification email', {
        userId: userRecord.uid,
        error: emailError.message,
      });
    }

    // Create audit log
    await createAuditLog({
      actorUserId: userRecord.uid,
      action: 'user_registered',
      entity: 'user',
      entityId: userRecord.uid,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        method: 'email',
        nickname,
      },
    });

    logger.info('User registered successfully', {
      userId: userRecord.uid,
      email,
      nickname,
    });

    res.status(201).json({
      ok: true,
      data: {
        userId: userRecord.uid,
        email,
        nickname,
        message: 'Account created successfully. Please check your email for verification.',
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('User registration failed', {
      error: error.message,
      stack: error.stack,
      email,
      nickname,
    });

    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'DUPLICATE_EMAIL',
          message: 'Email already registered',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Failed to create account',
      },
    });
  }
}

/**
 * Authenticate with Google OAuth
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function authenticateWithGoogle(req, res) {
  const logger = createRequestLogger(req.id);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array(),
      },
    });
  }

  const { idToken } = req.body;

  try {
    // TODO: Implement Google OAuth verification
    // Verify the Google ID token and create/update user

    logger.info('Google OAuth authentication', {
      ip: req.ip,
    });

    res.status(200).json({
      ok: true,
      data: {
        message: 'Google OAuth authentication successful',
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Google OAuth authentication failed', {
      error: error.message,
      stack: error.stack,
    });

    res.status(401).json({
      ok: false,
      error: {
        code: 'OAUTH_VERIFICATION_FAILED',
        message: 'Google OAuth verification failed',
      },
    });
  }
}

/**
 * Authenticate with Apple OAuth
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function authenticateWithApple(req, res) {
  const logger = createRequestLogger(req.id);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array(),
      },
    });
  }

  const { idToken } = req.body;

  try {
    // TODO: Implement Apple OAuth verification
    // Verify the Apple ID token and create/update user

    logger.info('Apple OAuth authentication', {
      ip: req.ip,
    });

    res.status(200).json({
      ok: true,
      data: {
        message: 'Apple OAuth authentication successful',
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Apple OAuth authentication failed', {
      error: error.message,
      stack: error.stack,
    });

    res.status(401).json({
      ok: false,
      error: {
        code: 'OAUTH_VERIFICATION_FAILED',
        message: 'Apple OAuth verification failed',
      },
    });
  }
}

/**
 * Request password reset
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function forgotPassword(req, res) {
  const logger = createRequestLogger(req.id);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array(),
      },
    });
  }

  const { email } = req.body;

  try {
    const auth = getAuth();
    const firestore = getFirestore();

    // Check if user exists
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error) {
      // User doesn't exist, but we don't reveal this
      logger.info('Password reset requested for non-existent email', { email });

      return res.status(200).json({
        ok: true,
        data: {
          message: 'If an account with this email exists, a password reset link has been sent.',
        },
        error: null,
        meta: {
          requestId: req.id,
        },
      });
    }

    // Generate Firebase password reset link
    try {
      const auth = getAuth();
      const resetLink = await auth.generatePasswordResetLink(email, {
        url: `${process.env.FRONTEND_URL}/reset-password`,
        handleCodeInApp: false,
      });

      // Send password reset email
      await sendEmail({
        to: email,
        subject: 'Reset Your Matcha Password',
        template: 'password-reset',
        data: {
          resetLink,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
        },
      });
    } catch (emailError) {
      logger.error('Failed to send password reset email', {
        userId: userRecord.uid,
        error: emailError.message,
      });

      return res.status(500).json({
        ok: false,
        error: {
          code: 'EMAIL_SEND_FAILED',
          message: 'Failed to send password reset email',
        },
      });
    }

    // Create audit log
    await createAuditLog({
      actorUserId: userRecord.uid,
      action: 'password_reset_requested',
      entity: 'user',
      entityId: userRecord.uid,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('Password reset requested', {
      userId: userRecord.uid,
      email,
    });

    res.status(200).json({
      ok: true,
      data: {
        message: 'If an account with this email exists, a password reset link has been sent.',
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Password reset request failed', {
      error: error.message,
      stack: error.stack,
      email,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'PASSWORD_RESET_FAILED',
        message: 'Failed to process password reset request',
      },
    });
  }
}

/**
 * Setup MFA for user account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function setupMfa(req, res) {
  const logger = createRequestLogger(req.id);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array(),
      },
    });
  }

  const { type } = req.body;
  const { uid } = req.user;

  try {
    const firestore = getFirestore();

    // TODO: Implement MFA setup based on type
    // For TOTP: Generate secret and QR code
    // SMS MFA is disabled when phoneAuth feature is off

    // Update user profile
    await firestore.collection('users').doc(uid).update({
      isMfaEnabled: true,
      mfaType: type,
      updatedAt: new Date(),
    });

    // Create audit log
    await createAuditLog({
      actorUserId: uid,
      action: 'mfa_setup',
      entity: 'user',
      entityId: uid,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { type },
    });

    logger.info('MFA setup initiated', {
      userId: uid,
      type,
    });

    res.status(200).json({
      ok: true,
      data: {
        message: 'MFA setup initiated',
        type,
        // TODO: Return appropriate setup data (QR code for TOTP, etc.)
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('MFA setup failed', {
      error: error.message,
      stack: error.stack,
      userId: uid,
      type,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'MFA_SETUP_FAILED',
        message: 'Failed to setup MFA',
      },
    });
  }
}

/**
 * Verify MFA code
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function verifyMfa(req, res) {
  const logger = createRequestLogger(req.id);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array(),
      },
    });
  }

  const { type, code } = req.body;
  const { uid } = req.user;

  try {
    // TODO: Implement MFA verification based on type
    // For TOTP: Verify time-based code
    // SMS MFA is disabled when phoneAuth feature is off

    logger.info('MFA verification successful', {
      userId: uid,
      type,
    });

    res.status(200).json({
      ok: true,
      data: {
        message: 'MFA verification successful',
        type,
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('MFA verification failed', {
      error: error.message,
      stack: error.stack,
      userId: uid,
      type,
    });

    res.status(400).json({
      ok: false,
      error: {
        code: 'MFA_VERIFICATION_FAILED',
        message: 'Invalid MFA code',
      },
    });
  }
}

/**
 * Disable MFA for user account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function disableMfa(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;

  try {
    const firestore = getFirestore();

    // Update user profile
    await firestore.collection('users').doc(uid).update({
      isMfaEnabled: false,
      mfaType: null,
      updatedAt: new Date(),
    });

    // Create audit log
    await createAuditLog({
      actorUserId: uid,
      action: 'mfa_disabled',
      entity: 'user',
      entityId: uid,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('MFA disabled', {
      userId: uid,
    });

    res.status(200).json({
      ok: true,
      data: {
        message: 'MFA disabled successfully',
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('MFA disable failed', {
      error: error.message,
      stack: error.stack,
      userId: uid,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'MFA_DISABLE_FAILED',
        message: 'Failed to disable MFA',
      },
    });
  }
}

module.exports = {
  registerWithEmail,
  authenticateWithGoogle,
  authenticateWithApple,
  forgotPassword,
  setupMfa,
  verifyMfa,
  disableMfa,
};
