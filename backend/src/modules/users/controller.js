const { validationResult } = require('express-validator');
const { getFirestore, revokeRefreshTokens } = require('../../../lib/firebase');
const { createRequestLogger } = require('../../lib/logger');
const { createAuditLog } = require('../audit/service');
const { db } = require('../../../lib/firebase');
const postsService = require('../posts/service');
const settingsService = require('./settings.service');
const {
  generateAvatarUploadUrl,
  getAvatarPublicUrl,
  deleteAvatar,
} = require('../../lib/avatarUpload');

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
 * Get public profile with privacy checks
 * GET /api/v1/users/:id
 */
async function getPublicProfile(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const targetId = req.params.id;
    const requesterId = req.user?.uid || null;
    const firestore = getFirestore();
    const userDoc = await firestore.collection('users').doc(targetId).get();
    if (!userDoc.exists) return res.status(404).json({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    const userData = userDoc.data();

    const settings = await require('./settings.service').getUserSettings(targetId);
    const isPrivate = settings.accountPrivacy === 'private';

    if (isPrivate && requesterId !== targetId) {
      return res.json({ ok: true, data: { uid: targetId, nickname: userData.nickname, avatarUrl: userData.avatarUrl || null, private: true }, meta: { message: 'This account is private' } });
    }

    return res.json({ ok: true, data: { uid: targetId, nickname: userData.nickname, avatarUrl: userData.avatarUrl || null, bio: userData.bio || null, private: false } });
  } catch (error) {
    logger.error('Failed to get public profile', { error: error.message, targetId: req.params.id });
    return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get user' } });
  }
}

/**
 * Get user's liked posts with privacy
 * GET /api/v1/users/:id/likes
 */
async function getUserLikedPosts(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const targetId = req.params.id;
    const requesterId = req.user?.uid || null;
    const settings = await require('./settings.service').getUserSettings(targetId);
    if (!settings.showLikedPosts && requesterId !== targetId) {
      return res.status(403).json({ ok: false, error: { code: 'LIKES_PRIVATE', message: 'Liked posts are private' } });
    }
    const result = await postsService.getSavedPosts(targetId, { pageSize: parseInt(req.query.pageSize || '20'), cursor: req.query.cursor || null });
    return res.json({ ok: true, data: result.posts, meta: { pagination: result.pagination } });
  } catch (error) {
    logger.error('Failed to get user liked posts', { error: error.message, targetId: req.params.id });
    return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get liked posts' } });
  }
}

/**
 * Get user's followers with privacy
 * GET /api/v1/users/:id/followers
 */
async function getUserFollowers(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const targetId = req.params.id;
    const requesterId = req.user?.uid || null;
    const settings = await require('./settings.service').getUserSettings(targetId);
    if (!settings.showFollowers && requesterId !== targetId) {
      return res.status(403).json({ ok: false, error: { code: 'FOLLOWERS_PRIVATE', message: 'Followers list is private' } });
    }
    const result = await settingsService.getDetailedFollowers(targetId, { pageSize: parseInt(req.query.pageSize || '20'), cursor: req.query.cursor || null });
    return res.json({ ok: true, data: result.followers, meta: { pagination: result.pagination } });
  } catch (error) {
    logger.error('Failed to get user followers', { error: error.message, targetId: req.params.id });
    return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get followers' } });
  }
}

/**
 * Get user's following with privacy
 * GET /api/v1/users/:id/following
 */
async function getUserFollowing(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const targetId = req.params.id;
    const requesterId = req.user?.uid || null;
    const settings = await require('./settings.service').getUserSettings(targetId);
    if (!settings.showFollowing && requesterId !== targetId) {
      return res.status(403).json({ ok: false, error: { code: 'FOLLOWING_PRIVATE', message: 'Following list is private' } });
    }
    const result = await settingsService.getDetailedFollowing(targetId, { pageSize: parseInt(req.query.pageSize || '20'), cursor: req.query.cursor || null });
    return res.json({ ok: true, data: result.following, meta: { pagination: result.pagination } });
  } catch (error) {
    logger.error('Failed to get user following', { error: error.message, targetId: req.params.id });
    return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get following' } });
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

  const { nickname, avatarUrl, media } = req.body;
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

    // Handle avatar URL - either from direct upload or provided URL
    if (avatarUrl) {
      updateData.avatarUrl = avatarUrl;
    } else if (media && media.length > 0) {
      // Use first uploaded media as avatar
      updateData.avatarUrl = media[0].url;
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

/**
 * Get my profile stats and posts
 * GET /api/v1/me/stats
 */
async function getMyStatsAndPosts(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;
  try {
    // Counts (avoid composite indexes by filtering isDeleted client-side)
    const [userPostsSnap, followersSnap, followingSnap, likesSnap, savesSnap] = await Promise.all([
      db.collection('posts').where('authorId', '==', uid).get(),
      db.collection('follows').where('followedId', '==', uid).get(),
      db.collection('follows').where('followerId', '==', uid).get(),
      // Likes mirror top-level collection
      db.collection('likes').where('userId', '==', uid).get().catch(() => ({ size: 0 })),
      db.collection('saves').where('userId', '==', uid).get().catch(() => ({ size: 0 })),
    ]);

    const totalUserPosts = userPostsSnap.docs.filter(d => !d.data().isDeleted).length;

    // Fetch recent posts (limit 20), filter out deleted in memory
    const recentPostsSnap = await db
      .collection('posts')
      .where('authorId', '==', uid)
      .limit(200)
      .get();

    const posts = recentPostsSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(p => !p.isDeleted)
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return tb - ta;
      })
      .slice(0, 20);

    return res.json({
      ok: true,
      data: {
        stats: {
          posts: totalUserPosts,
          followers: followersSnap.size,
          following: followingSnap.size,
          likes: likesSnap.size || 0,
          saves: savesSnap.size || 0,
        },
        posts,
      },
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to get my stats and posts', {
      error: error.message,
      code: error.code,
      stack: error.stack,
      uid,
    });
    // Ensure visibility during development
    // eslint-disable-next-line no-console
    console.error('getMyStatsAndPosts error:', error);
    const devDetails = process.env.NODE_ENV !== 'production' ? { details: error.message, stack: error.stack } : {};
    return res.status(500).json({ ok: false, error: { code: 'PROFILE_STATS_FAILED', message: 'Failed to retrieve stats', ...devDetails } });
  }
}

/**
 * Get my liked posts
 * GET /api/v1/me/likes
 */
async function getMyLikedPosts(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;
  const { pageSize = 20 } = req.query;
  try {
    // Likes are stored under posts/{postId}/votes/{uid} with value=1
    // Query across posts isn't trivial; use a votes collection if available, otherwise scan limited
    const votesSnapshot = await db
      .collectionGroup('votes')
      .where('value', '==', 1)
      .where('uid', '==', uid)
      .limit(parseInt(pageSize))
      .get()
      .catch(() => null);

    let posts = [];
    if (votesSnapshot && !votesSnapshot.empty) {
      const postIds = votesSnapshot.docs.map(doc => doc.ref.parent.parent.id);
      const uniqueIds = Array.from(new Set(postIds));
      const fetches = uniqueIds.map(id => db.collection('posts').doc(id).get());
      const docs = await Promise.all(fetches);
      posts = docs.filter(d => d.exists && !d.data().isDeleted).map(d => ({ id: d.id, ...d.data() }));
    } else {
      // Fallback: query a top-level likes collection if exists
      const likesRef = db.collection('likes');
      const likes = await likesRef.where('userId', '==', uid).limit(parseInt(pageSize)).get().catch(() => null);
      if (likes && !likes.empty) {
        const postIds = likes.docs.map(d => d.data().postId);
        const uniqueIds = Array.from(new Set(postIds));
        const fetches = uniqueIds.map(id => db.collection('posts').doc(id).get());
        const docs = await Promise.all(fetches);
        posts = docs.filter(d => d.exists && !d.data().isDeleted).map(d => ({ id: d.id, ...d.data() }));
      }
    }

    return res.json({ ok: true, data: posts });
  } catch (error) {
    logger.error('Failed to get my liked posts', { error: error.message, uid });
    return res.status(500).json({ ok: false, error: { code: 'LIKES_FETCH_FAILED', message: 'Failed to fetch liked posts' } });
  }
}

module.exports = {
  getProfile,
  getPublicProfile,
  getUserLikedPosts,
  getUserFollowers,
  getUserFollowing,
  updateProfile,
  sendEmailVerification,
  logout,
  logoutAll,
  deleteAccount,
  generateAvatarUploadUrl: handleAvatarUploadUrl,
  confirmAvatarUpload,
  getMyStatsAndPosts,
  getMyLikedPosts,
};
