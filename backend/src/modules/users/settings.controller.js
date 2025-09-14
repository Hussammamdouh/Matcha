const { createRequestLogger } = require('../../lib/logger');
const settingsService = require('./settings.service');

/**
 * Get user settings
 * GET /api/v1/me/settings
 */
async function getUserSettings(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;

  try {
    const settings = await settingsService.getUserSettings(uid);

    logger.info('User settings retrieved', { userId: uid });

    return res.json({
      ok: true,
      data: settings,
    });
  } catch (error) {
    logger.error('Failed to get user settings', { error: error.message, userId: uid });

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user settings',
      },
    });
  }
}

/**
 * Update user settings
 * PATCH /api/v1/me/settings
 */
async function updateUserSettings(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;
  const settingsData = req.body;

  try {
    const updatedSettings = await settingsService.updateUserSettings(uid, settingsData);

    logger.info('User settings updated', { userId: uid, updatedFields: Object.keys(settingsData) });

    return res.json({
      ok: true,
      data: updatedSettings,
    });
  } catch (error) {
    logger.error('Failed to update user settings', { error: error.message, userId: uid });

    if (error.message === 'No valid settings fields provided') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'No valid settings fields provided',
        },
      });
    }

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update user settings',
      },
    });
  }
}

/**
 * Get user's communities
 * GET /api/v1/me/communities
 */
async function getUserCommunities(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;
  const { cursor, pageSize = 20 } = req.query;

  try {
    const options = {
      cursor: cursor || null,
      pageSize: Math.min(parseInt(pageSize) || 20, 100),
    };

    const result = await settingsService.getUserCommunities(uid, options);

    logger.info('User communities retrieved', { userId: uid, count: result.communities.length });

    return res.json({
      ok: true,
      data: result.communities,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Failed to get user communities', { error: error.message, userId: uid });

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user communities',
      },
    });
  }
}

/**
 * Get detailed followers list
 * GET /api/v1/me/followers
 */
async function getDetailedFollowers(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;
  const { cursor, pageSize = 20 } = req.query;

  try {
    const options = {
      cursor: cursor || null,
      pageSize: Math.min(parseInt(pageSize) || 20, 100),
    };

    const result = await settingsService.getDetailedFollowers(uid, options);

    logger.info('Detailed followers retrieved', { userId: uid, count: result.followers.length });

    return res.json({
      ok: true,
      data: result.followers,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Failed to get detailed followers', { error: error.message, userId: uid });

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get detailed followers',
      },
    });
  }
}

/**
 * Get detailed following list
 * GET /api/v1/me/following
 */
async function getDetailedFollowing(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;
  const { cursor, pageSize = 20 } = req.query;

  try {
    const options = {
      cursor: cursor || null,
      pageSize: Math.min(parseInt(pageSize) || 20, 100),
    };

    const result = await settingsService.getDetailedFollowing(uid, options);

    logger.info('Detailed following retrieved', { userId: uid, count: result.following.length });

    return res.json({
      ok: true,
      data: result.following,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Failed to get detailed following', { error: error.message, userId: uid });

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get detailed following',
      },
    });
  }
}

/**
 * Get detailed blocked users list
 * GET /api/v1/me/blocked
 */
async function getDetailedBlockedUsers(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;
  const { cursor, pageSize = 20 } = req.query;

  try {
    const options = {
      cursor: cursor || null,
      pageSize: Math.min(parseInt(pageSize) || 20, 100),
    };

    const result = await settingsService.getDetailedBlockedUsers(uid, options);

    logger.info('Detailed blocked users retrieved', { userId: uid, count: result.blockedUsers.length });

    return res.json({
      ok: true,
      data: result.blockedUsers,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Failed to get detailed blocked users', { error: error.message, userId: uid });

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get detailed blocked users',
      },
    });
  }
}

module.exports = {
  getUserSettings,
  updateUserSettings,
  getUserCommunities,
  getDetailedFollowers,
  getDetailedFollowing,
  getDetailedBlockedUsers,
};
