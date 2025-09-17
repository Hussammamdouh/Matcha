const { createModuleLogger } = require('../../../lib/logger');
const conversationsService = require('./service');

const logger = createModuleLogger();

/**
 * Create a new conversation
 */
async function createConversation(req, res) {
  try {
    const { type, title, icon, memberUserIds } = req.body;
    const userId = req.user.uid;

    // Add creator to member list if not already included
    const allMembers = memberUserIds.includes(userId) 
      ? memberUserIds 
      : [userId, ...memberUserIds];

    const conversation = await conversationsService.createConversation({
      type,
      createdBy: userId,
      title,
      icon,
      memberUserIds: allMembers,
    });

    res.status(201).json({
      ok: true,
      data: conversation,
    });
  } catch (error) {
    logger.error('Failed to create conversation', {
      error: error.message,
      userId: req.user.uid,
      body: req.body,
    });

    res.status(400).json({
      ok: false,
      error: {
        code: 'CONVERSATION_CREATION_FAILED',
        message: error.message,
      },
    });
  }
}

/**
 * Get a conversation by ID
 */
async function getConversation(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const conversation = await conversationsService.getConversation(id, userId);

    res.json({
      ok: true,
      data: conversation,
    });
  } catch (error) {
    logger.error('Failed to get conversation', {
      error: error.message,
      conversationId: req.params.id,
      userId: req.user.uid,
    });

    if (error.message.includes('not a participant')) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'NOT_PARTICIPANT',
          message: 'You are not a participant in this conversation',
        },
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'Conversation not found',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve conversation',
      },
    });
  }
}

/**
 * List user's conversations
 */
async function listConversations(req, res) {
  try {
    const userId = req.user.uid;
    const { cursor, pageSize = 20 } = req.query;

    const result = await conversationsService.listConversations(userId, {
      cursor,
      pageSize: parseInt(pageSize),
    });

    res.json({
      ok: true,
      data: result.conversations,
      meta: result.meta,
    });
  } catch (error) {
    logger.error('Failed to list conversations', {
      error: error.message,
      userId: req.user.uid,
      query: req.query,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve conversations',
      },
    });
  }
}

/**
 * Join a conversation
 */
async function joinConversation(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const conversation = await conversationsService.joinConversation(id, userId);

    res.json({
      ok: true,
      data: conversation,
    });
  } catch (error) {
    logger.error('Failed to join conversation', {
      error: error.message,
      conversationId: req.params.id,
      userId: req.user.uid,
    });

    if (error.message.includes('already a participant')) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'ALREADY_PARTICIPANT',
          message: error.message,
        },
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'Conversation not found',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to join conversation',
      },
    });
  }
}

/**
 * Leave a conversation
 */
async function leaveConversation(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    await conversationsService.leaveConversation(id, userId);

    res.json({
      ok: true,
      data: { success: true },
    });
  } catch (error) {
    logger.error('Failed to leave conversation', {
      error: error.message,
      conversationId: req.params.id,
      userId: req.user.uid,
    });

    if (error.message.includes('not a participant')) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'NOT_PARTICIPANT',
          message: 'You are not a participant in this conversation',
        },
      });
    }

    if (error.message.includes('Owner cannot leave')) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'OWNER_CANNOT_LEAVE',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to leave conversation',
      },
    });
  }
}

/**
 * Update conversation
 */
async function updateConversation(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const updates = req.body;

    const conversation = await conversationsService.updateConversation(id, userId, updates);

    res.json({
      ok: true,
      data: conversation,
    });
  } catch (error) {
    logger.error('Failed to update conversation', {
      error: error.message,
      conversationId: req.params.id,
      userId: req.user.uid,
      updates: req.body,
    });

    if (error.message.includes('Only moderators')) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: error.message,
        },
      });
    }

    if (error.message.includes('No valid updates')) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_UPDATES',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update conversation',
      },
    });
  }
}

/**
 * Toggle conversation mute status
 */
async function toggleMute(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const { isMuted } = req.body;

    if (typeof isMuted !== 'boolean') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'isMuted must be a boolean',
        },
      });
    }

    await conversationsService.toggleMute(id, userId, isMuted);

    res.json({
      ok: true,
      data: { isMuted },
    });
  } catch (error) {
    logger.error('Failed to toggle conversation mute', {
      error: error.message,
      conversationId: req.params.id,
      userId: req.user.uid,
      isMuted: req.body.isMuted,
    });

    if (error.message.includes('not a participant')) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'NOT_PARTICIPANT',
          message: 'You are not a participant in this conversation',
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update mute status',
      },
    });
  }
}

/**
 * Delete a conversation (owner or admin) or participant when policy allows
 * DELETE /api/v1/chat/conversations/:id
 */
async function deleteConversation(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    await conversationsService.deleteConversation(id, userId);

    res.json({ ok: true, data: { success: true } });
  } catch (error) {
    logger.error('Failed to delete conversation', {
      error: error.message,
      conversationId: req.params.id,
      userId: req.user.uid,
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
    }

    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete conversation' } });
  }
}

module.exports = {
  createConversation,
  getConversation,
  listConversations,
  joinConversation,
  leaveConversation,
  updateConversation,
  toggleMute,
  deleteConversation,
};
