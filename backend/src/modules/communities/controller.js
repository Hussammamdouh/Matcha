const { createModuleLogger } = require('../../lib/logger');
const communitiesService = require('./service');

const logger = createModuleLogger();

/**
 * Communities controller for Matcha
 * Handles HTTP requests and responses for community operations
 */

/**
 * Create a new community
 * POST /api/v1/communities
 */
async function createCommunity(req, res) {
  try {
    const { uid } = req.user;
    const communityData = req.body;

    logger.info('Creating community', {
      userId: uid,
      communityName: communityData.name,
    });

    const community = await communitiesService.createCommunity(communityData, uid);

    res.status(201).json({
      ok: true,
      data: community,
      meta: {
        message: 'Community created successfully',
      },
    });
  } catch (error) {
    logger.error('Failed to create community', {
      error: error.message,
      userId: req.user?.uid,
    });

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'COMMUNITY_EXISTS',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create community',
      },
    });
  }
}

/**
 * Get community by ID
 * GET /api/v1/communities/:id
 */
async function getCommunity(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user || {};

    logger.info('Getting community', {
      communityId: id,
      userId: uid,
    });

    const community = await communitiesService.getCommunity(id, uid);

    if (!community) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Community not found',
        },
      });
    }

    res.json({
      ok: true,
      data: community,
    });
  } catch (error) {
    logger.error('Failed to get community', {
      error: error.message,
      communityId: req.params.id,
      userId: req.user?.uid,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get community',
      },
    });
  }
}

/**
 * List communities with filtering and pagination
 * GET /api/v1/communities
 */
async function listCommunities(req, res) {
  try {
    const { q = '', category = '', sort = 'trending', pageSize = 20, cursor = null } = req.query;

    logger.info('Listing communities', {
      query: q,
      category,
      sort,
      pageSize: parseInt(pageSize),
      hasCursor: !!cursor,
    });

    const result = await communitiesService.listCommunities({
      q,
      category,
      sort,
      pageSize: parseInt(pageSize),
      cursor,
    });

    res.json({
      ok: true,
      data: result.communities,
      meta: {
        pagination: result.pagination,
        filters: { q, category, sort },
      },
    });
  } catch (error) {
    logger.error('Failed to list communities', {
      error: error.message,
      query: req.query,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list communities',
      },
    });
  }
}

/**
 * Update community
 * PATCH /api/v1/communities/:id
 */
async function updateCommunity(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user;
    const updateData = req.body;

    logger.info('Updating community', {
      communityId: id,
      userId: uid,
      updateFields: Object.keys(updateData),
    });

    const community = await communitiesService.updateCommunity(id, updateData, uid);

    res.json({
      ok: true,
      data: community,
      meta: {
        message: 'Community updated successfully',
      },
    });
  } catch (error) {
    logger.error('Failed to update community', {
      error: error.message,
      communityId: req.params.id,
      userId: req.user?.uid,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Community not found',
        },
      });
    }

    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to update community',
        },
      });
    }

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'COMMUNITY_EXISTS',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update community',
      },
    });
  }
}

/**
 * Join a community
 * POST /api/v1/communities/:id/join
 */
async function joinCommunity(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user;

    logger.info('User joining community', {
      communityId: id,
      userId: uid,
    });

    const membership = await communitiesService.joinCommunity(id, uid);

    res.status(201).json({
      ok: true,
      data: membership,
      meta: {
        message: 'Successfully joined community',
      },
    });
  } catch (error) {
    logger.error('Failed to join community', {
      error: error.message,
      communityId: req.params.id,
      userId: req.user?.uid,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Community not found',
        },
      });
    }

    if (error.message.includes('Already a member')) {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'ALREADY_MEMBER',
          message: 'Already a member of this community',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to join community',
      },
    });
  }
}

/**
 * Leave a community
 * POST /api/v1/communities/:id/leave
 */
async function leaveCommunity(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user;

    logger.info('User leaving community', {
      communityId: id,
      userId: uid,
    });

    await communitiesService.leaveCommunity(id, uid);

    res.json({
      ok: true,
      data: null,
      meta: {
        message: 'Successfully left community',
      },
    });
  } catch (error) {
    logger.error('Failed to leave community', {
      error: error.message,
      communityId: req.params.id,
      userId: req.user?.uid,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Community not found',
        },
      });
    }

    if (error.message.includes('Not a member')) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'NOT_MEMBER',
          message: 'Not a member of this community',
        },
      });
    }

    if (error.message.includes('cannot leave')) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'OWNER_CANNOT_LEAVE',
          message: 'Community owner cannot leave. Transfer ownership first.',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to leave community',
      },
    });
  }
}

/**
 * Get community moderators
 * GET /api/v1/communities/:id/moderators
 */
async function getModerators(req, res) {
  try {
    const { id } = req.params;

    logger.info('Getting community moderators', {
      communityId: id,
    });

    const moderators = await communitiesService.getModerators(id);

    res.json({
      ok: true,
      data: moderators,
    });
  } catch (error) {
    logger.error('Failed to get community moderators', {
      error: error.message,
      communityId: req.params.id,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Community not found',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get community moderators',
      },
    });
  }
}

/**
 * List community members
 * GET /api/v1/communities/:id/members
 */
async function listMembers(req, res) {
  try {
    const { id } = req.params;
    const { pageSize = 20, cursor = null } = req.query;
    const result = await communitiesService.listMembers(id, { pageSize: parseInt(pageSize), cursor });
    return res.json({ ok: true, data: result.members, meta: { pagination: result.pagination } });
  } catch (error) {
    return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list members' } });
  }
}

/**
 * Delete community (owner or admin only)
 * DELETE /api/v1/communities/:id
 */
async function deleteCommunity(req, res) {
  try {
    const { id } = req.params;
    const { uid } = req.user;

    logger.info('Deleting community', { communityId: id, userId: uid });

    await communitiesService.deleteCommunity(id, uid);

    res.json({
      ok: true,
      data: null,
      meta: { message: 'Community deleted successfully' },
    });
  } catch (error) {
    logger.error('Failed to delete community', {
      error: error.message,
      communityId: req.params.id,
      userId: req.user?.uid,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Community not found' },
      });
    }

    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions to delete community' },
      });
    }

    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete community' },
    });
  }
}

module.exports = {
  createCommunity,
  getCommunity,
  listCommunities,
  updateCommunity,
  joinCommunity,
  leaveCommunity,
  getModerators,
  listMembers,
  deleteCommunity,
};
