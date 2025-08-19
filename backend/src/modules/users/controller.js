const { validationResult } = require('express-validator');
const { getFirestore, revokeRefreshTokens } = require('../../lib/firebase');
const { createRequestLogger } = require('../../lib/logger');
const { createAuditLog } = require('../audit/service');
const { generateAvatarUploadUrl, getAvatarPublicUrl, deleteAvatar } = require('../../lib/avatarUpload');

/**
 * Get current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getProfile(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;

  try {
    const firestore = getFirestore();
    const userDoc = await firestore.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found',
        },
      });
    }

    const userData = userDoc.data();

    res.status(200).json({
      ok: true,
      data: {
        uid: userData.uid,
        email: userData.email,
        nickname: userData.nickname,
        avatarUrl: userData.avatarUrl,
        status: userData.status,
        genderVerificationStatus: userData.genderVerificationStatus,
        isMfaEnabled: userData.isMfaEnabled,
        createdAt: userData.createdAt.toDate().toISOString(),
        updatedAt: userData.updatedAt.toDate().toISOString(),
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Failed to get user profile', {
      error: error.message,
      stack: error.stack,
      userId: uid,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'PROFILE_RETRIEVAL_FAILED',
        message: 'Failed to retrieve user profile',
      },
    });
  }
}

/**
 * Update current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateProfile(req, res) {
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

  const { nickname, avatarUrl } = req.body;
  const { uid } = req.user;

  try {
    const firestore = getFirestore();
    const updateData = { updatedAt: new Date() };

    if (nickname) {
      // Check if nickname is already taken
      const nicknameQuery = await firestore
        .collection('users')
        .where('nickname', '==', nickname)
        .where('uid', '!=', uid)
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

      updateData.nickname = nickname;
    }

    if (avatarUrl) {
      updateData.avatarUrl = avatarUrl;
    }

    // Update user profile
    await firestore.collection('users').doc(uid).update(updateData);

    // Create audit log
    await createAuditLog({
      actorUserId: uid,
      action: 'profile_updated',
      entity: 'user',
      entityId: uid,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { updates: Object.keys(updateData).filter(key => key !== 'updatedAt') },
    });

    logger.info('User profile updated', {
      userId: uid,
      updates: Object.keys(updateData).filter(key => key !== 'updatedAt'),
    });

    res.status(200).json({
      ok: true,
      data: {
        message: 'Profile updated successfully',
        updates: Object.keys(updateData).filter(key => key !== 'updatedAt'),
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Failed to update user profile', {
      error: error.message,
      stack: error.stack,
      userId: uid,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'PROFILE_UPDATE_FAILED',
        message: 'Failed to update profile',
      },
    });
  }
}

/**
 * Send email verification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function sendEmailVerification(req, res) {
  // TODO: Implement email verification
  res.status(200).json({
    ok: true,
    data: {
      message: 'Email verification sent',
    },
    error: null,
    meta: {
      requestId: req.id,
    },
  });
}



/**
 * Logout current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function logout(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;

  try {
    // Revoke refresh tokens for current session
    await revokeRefreshTokens(uid);

    // Create audit log
    await createAuditLog({
      actorUserId: uid,
      action: 'logout',
      entity: 'user',
      entityId: uid,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('User logged out', {
      userId: uid,
    });

    res.status(200).json({
      ok: true,
      data: {
        message: 'Logout successful',
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Logout failed', {
      error: error.message,
      stack: error.stack,
      userId: uid,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'LOGOUT_FAILED',
        message: 'Logout failed',
      },
    });
  }
}

/**
 * Logout from all devices
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function logoutAll(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;

  try {
    // Revoke all refresh tokens
    await revokeRefreshTokens(uid);

    // Create audit log
    await createAuditLog({
      actorUserId: uid,
      action: 'logout_all',
      entity: 'user',
      entityId: uid,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('User logged out from all devices', {
      userId: uid,
    });

    res.status(200).json({
      ok: true,
      data: {
        message: 'Logged out from all devices successfully',
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Logout from all devices failed', {
      error: error.message,
      stack: error.stack,
      userId: uid,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'LOGOUT_ALL_FAILED',
        message: 'Failed to logout from all devices',
      },
    });
  }
}

/**
 * Delete current user account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteAccount(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;

  try {
    // TODO: Implement account deletion via Cloud Tasks
    // This should be an async operation that cleans up all user data

    // Create audit log
    await createAuditLog({
      actorUserId: uid,
      action: 'account_deletion_requested',
      entity: 'user',
      entityId: uid,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info('Account deletion requested', {
      userId: uid,
    });

    res.status(200).json({
      ok: true,
      data: {
        message: 'Account deletion initiated. This process may take up to 30 days to complete.',
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Account deletion request failed', {
      error: error.message,
      stack: error.stack,
      userId: uid,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'ACCOUNT_DELETION_FAILED',
        message: 'Failed to initiate account deletion',
      },
    });
  }
}

/**
 * Generate avatar upload URL
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleAvatarUploadUrl(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;
  const { fileName, contentType } = req.body;

  try {
    if (!fileName || !contentType) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'fileName and contentType are required',
        },
        meta: {
          requestId: req.id,
        },
      });
    }

    // Import the utility function with a different name to avoid conflict
    const { generateAvatarUploadUrl: generateUploadUrl } = require('../../lib/avatarUpload');
    const uploadData = await generateUploadUrl(uid, fileName, contentType);

    res.status(200).json({
      ok: true,
      data: uploadData,
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Failed to generate avatar upload URL', {
      error: error.message,
      stack: error.stack,
      userId: uid,
      fileName,
      contentType,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'AVATAR_UPLOAD_URL_FAILED',
        message: 'Failed to generate upload URL',
      },
      meta: {
        requestId: req.id,
      },
    });
  }
}

/**
 * Confirm avatar upload and update profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function confirmAvatarUpload(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;
  const { filePath } = req.body;

  try {
    if (!filePath) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'filePath is required',
        },
        meta: {
          requestId: req.id,
        },
      });
    }

    const firestore = getFirestore();
    
    // Get current avatar URL to delete old file
    const userDoc = await firestore.collection('users').doc(uid).get();
    const userData = userDoc.data();
    const oldAvatarUrl = userData.avatarUrl;
    
    // Generate new public URL
    const newAvatarUrl = getAvatarPublicUrl(filePath);
    
    // Update user profile
    await firestore.collection('users').doc(uid).update({
      avatarUrl: newAvatarUrl,
      updatedAt: new Date(),
    });

    // Delete old avatar file if it exists
    if (oldAvatarUrl && oldAvatarUrl.includes('storage.googleapis.com')) {
      try {
        const oldFilePath = oldAvatarUrl.split('storage.googleapis.com/')[1];
        if (oldFilePath) {
          await deleteAvatar(oldFilePath);
        }
      } catch (deleteError) {
        logger.warn('Failed to delete old avatar file', {
          error: deleteError.message,
          oldAvatarUrl,
          userId: uid,
        });
      }
    }

    // Create audit log
    await createAuditLog({
      actorUserId: uid,
      authentication: true,
      action: 'avatar_updated',
      entity: 'user',
      entityId: uid,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        oldAvatarUrl,
        newAvatarUrl,
        filePath,
      },
    });

    logger.info('Avatar updated successfully', {
      userId: uid,
      filePath,
      newAvatarUrl,
    });

    res.status(200).json({
      ok: true,
      data: {
        message: 'Avatar updated successfully',
        avatarUrl: newAvatarUrl,
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Failed to confirm avatar upload', {
      error: error.message,
      stack: error.stack,
      userId: uid,
      filePath,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'AVATAR_UPDATE_FAILED',
        message: 'Failed to update avatar',
      },
      meta: {
        requestId: req.id,
      },
    });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  sendEmailVerification,
  logout,
  logoutAll,
  deleteAccount,
  generateAvatarUploadUrl: handleAvatarUploadUrl,
  confirmAvatarUpload,
};
