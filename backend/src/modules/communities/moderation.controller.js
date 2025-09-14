const { createRequestLogger } = require('../../lib/logger');
const moderationService = require('./moderation.service');

/**
 * Get community moderators
 * GET /api/v1/communities/:id/moderators
 */
async function getModerators(req, res) {
  const logger = createRequestLogger(req.id);
  const { id: communityId } = req.params;
  const { cursor, pageSize = 20 } = req.query;

  try {
    const options = {
      cursor: cursor || null,
      pageSize: Math.min(parseInt(pageSize) || 20, 100),
    };

    const result = await moderationService.getModerators(communityId, options);

    logger.info('Community moderators retrieved', { 
      communityId, 
      count: result.moderators.length 
    });

    return res.json({
      ok: true,
      data: result.moderators,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Failed to get moderators', { 
      error: error.message, 
      communityId 
    });

    if (error.message === 'Community not found') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'COMMUNITY_NOT_FOUND',
          message: 'Community not found',
        },
      });
    }

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get moderators',
      },
    });
  }
}

/**
 * Add a moderator to a community
 * POST /api/v1/communities/:id/moderators
 */
async function addModerator(req, res) {
  const logger = createRequestLogger(req.id);
  const { id: communityId } = req.params;
  const { userId: moderatorUserId } = req.body;
  const { uid: actorUserId } = req.user;

  try {
    if (!moderatorUserId) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'MISSING_FIELD',
          message: 'userId is required',
        },
      });
    }

    const moderator = await moderationService.addModerator(
      communityId, 
      moderatorUserId, 
      actorUserId
    );

    logger.info('Moderator added to community', { 
      communityId, 
      moderatorUserId, 
      actorUserId 
    });

    return res.status(201).json({
      ok: true,
      data: moderator,
    });
  } catch (error) {
    logger.error('Failed to add moderator', { 
      error: error.message, 
      communityId, 
      moderatorUserId, 
      actorUserId 
    });

    if (error.message === 'Community not found') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'COMMUNITY_NOT_FOUND',
          message: 'Community not found',
        },
      });
    }

    if (error.message === 'Insufficient permissions to add moderators') {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to add moderators',
        },
      });
    }

    if (error.message === 'User is already the owner of this community' ||
        error.message === 'User is already a moderator' ||
        error.message === 'User must be a member of the community to become a moderator') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: error.message,
        },
      });
    }

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to add moderator',
      },
    });
  }
}

/**
 * Remove a moderator from a community
 * DELETE /api/v1/communities/:id/moderators/:userId
 */
async function removeModerator(req, res) {
  const logger = createRequestLogger(req.id);
  const { id: communityId, userId: moderatorUserId } = req.params;
  const { uid: actorUserId } = req.user;

  try {
    await moderationService.removeModerator(
      communityId, 
      moderatorUserId, 
      actorUserId
    );

    logger.info('Moderator removed from community', { 
      communityId, 
      moderatorUserId, 
      actorUserId 
    });

    return res.json({
      ok: true,
      data: { message: 'Moderator removed successfully' },
    });
  } catch (error) {
    logger.error('Failed to remove moderator', { 
      error: error.message, 
      communityId, 
      moderatorUserId, 
      actorUserId 
    });

    if (error.message === 'Community not found') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'COMMUNITY_NOT_FOUND',
          message: 'Community not found',
        },
      });
    }

    if (error.message === 'Insufficient permissions to remove moderators') {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to remove moderators',
        },
      });
    }

    if (error.message === 'Cannot remove the owner as a moderator') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: error.message,
        },
      });
    }

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to remove moderator',
      },
    });
  }
}

/**
 * Ban a user from a community
 * POST /api/v1/communities/:id/ban
 */
async function banUser(req, res) {
  const logger = createRequestLogger(req.id);
  const { id: communityId } = req.params;
  const { userId: bannedUserId, reason = '' } = req.body;
  const { uid: actorUserId } = req.user;

  try {
    if (!bannedUserId) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'MISSING_FIELD',
          message: 'userId is required',
        },
      });
    }

    const banRecord = await moderationService.banUser(
      communityId, 
      bannedUserId, 
      actorUserId, 
      reason
    );

    logger.info('User banned from community', { 
      communityId, 
      bannedUserId, 
      actorUserId, 
      reason 
    });

    return res.status(201).json({
      ok: true,
      data: banRecord,
    });
  } catch (error) {
    logger.error('Failed to ban user', { 
      error: error.message, 
      communityId, 
      bannedUserId, 
      actorUserId 
    });

    if (error.message === 'Community not found') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'COMMUNITY_NOT_FOUND',
          message: 'Community not found',
        },
      });
    }

    if (error.message === 'Insufficient permissions to ban users') {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to ban users',
        },
      });
    }

    if (error.message === 'Cannot ban the owner of the community' ||
        error.message === 'User is already banned from this community') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: error.message,
        },
      });
    }

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to ban user',
      },
    });
  }
}

/**
 * Unban a user from a community
 * DELETE /api/v1/communities/:id/ban/:userId
 */
async function unbanUser(req, res) {
  const logger = createRequestLogger(req.id);
  const { id: communityId, userId: bannedUserId } = req.params;
  const { uid: actorUserId } = req.user;

  try {
    await moderationService.unbanUser(
      communityId, 
      bannedUserId, 
      actorUserId
    );

    logger.info('User unbanned from community', { 
      communityId, 
      bannedUserId, 
      actorUserId 
    });

    return res.json({
      ok: true,
      data: { message: 'User unbanned successfully' },
    });
  } catch (error) {
    logger.error('Failed to unban user', { 
      error: error.message, 
      communityId, 
      bannedUserId, 
      actorUserId 
    });

    if (error.message === 'Community not found') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'COMMUNITY_NOT_FOUND',
          message: 'Community not found',
        },
      });
    }

    if (error.message === 'Insufficient permissions to unban users') {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to unban users',
        },
      });
    }

    if (error.message === 'User is not banned from this community') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'USER_NOT_BANNED',
          message: 'User is not banned from this community',
        },
      });
    }

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to unban user',
      },
    });
  }
}

/**
 * Get banned users from a community
 * GET /api/v1/communities/:id/banned
 */
async function getBannedUsers(req, res) {
  const logger = createRequestLogger(req.id);
  const { id: communityId } = req.params;
  const { cursor, pageSize = 20 } = req.query;

  try {
    const options = {
      cursor: cursor || null,
      pageSize: Math.min(parseInt(pageSize) || 20, 100),
    };

    const result = await moderationService.getBannedUsers(communityId, options);

    logger.info('Banned users retrieved', { 
      communityId, 
      count: result.bannedUsers.length 
    });

    return res.json({
      ok: true,
      data: result.bannedUsers,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Failed to get banned users', { 
      error: error.message, 
      communityId 
    });

    if (error.message === 'Community not found') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'COMMUNITY_NOT_FOUND',
          message: 'Community not found',
        },
      });
    }

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get banned users',
      },
    });
  }
}

module.exports = {
  getModerators,
  addModerator,
  removeModerator,
  banUser,
  unbanUser,
  getBannedUsers,
};
