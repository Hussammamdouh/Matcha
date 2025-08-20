const { createModuleLogger } = require('../../../lib/logger');
const blocksService = require('./service');

const logger = createModuleLogger('chat:blocks:controller');

/**
 * Block a user
 * POST /api/v1/chat/blocks
 */
async function blockUser(req, res) {
  try {
    const { blockedUserId } = req.body;
    const userId = req.user.uid;

    if (!blockedUserId) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'MISSING_FIELD',
          message: 'blockedUserId is required',
        },
      });
    }

    const block = await blocksService.blockUser(userId, blockedUserId);

    res.status(201).json({
      ok: true,
      data: block,
    });
  } catch (error) {
    logger.error('Failed to block user', { error: error.message, userId: req.user.uid });

    if (error.message === 'Cannot block yourself') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to block user',
      },
    });
  }
}

/**
 * Unblock a user
 * DELETE /api/v1/chat/blocks/:blockedUserId
 */
async function unblockUser(req, res) {
  try {
    const { blockedUserId } = req.params;
    const userId = req.user.uid;

    await blocksService.unblockUser(userId, blockedUserId);

    res.json({
      ok: true,
      data: { message: 'User unblocked successfully' },
    });
  } catch (error) {
    logger.error('Failed to unblock user', { error: error.message, userId: req.user.uid });

    if (error.message === 'Block not found') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Block not found',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to unblock user',
      },
    });
  }
}

/**
 * Get list of blocked users
 * GET /api/v1/chat/blocks
 */
async function getBlockedUsers(req, res) {
  try {
    const userId = req.user.uid;
    const { cursor, pageSize = 20 } = req.query;

    const options = {
      cursor: cursor || null,
      pageSize: Math.min(parseInt(pageSize) || 20, 100), // Max 100
    };

    const result = await blocksService.getBlockedUsers(userId, options);

    res.json({
      ok: true,
      data: result.blocks,
      meta: result.meta,
    });
  } catch (error) {
    logger.error('Failed to get blocked users', { error: error.message, userId: req.user.uid });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get blocked users',
      },
    });
  }
}

module.exports = {
  blockUser,
  unblockUser,
  getBlockedUsers,
};
