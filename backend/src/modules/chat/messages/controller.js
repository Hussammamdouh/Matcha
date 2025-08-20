const { createModuleLogger } = require('../../../lib/logger');
const messagesService = require('./service');

const logger = createModuleLogger();

/**
 * Send a message
 */
async function sendMessage(req, res) {
  try {
    const { conversationId, type, text, media } = req.body;
    const userId = req.user.uid;

    const message = await messagesService.sendMessage({
      conversationId,
      authorId: userId,
      type,
      text,
      media,
    });

    res.status(201).json({
      ok: true,
      data: message,
    });
  } catch (error) {
    logger.error('Failed to send message', {
      error: error.message,
      userId: req.user.uid,
      body: req.body,
    });

    if (error.message.includes('not a participant')) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'NOT_PARTICIPANT',
          message: error.message,
        },
      });
    }

    if (error.message.includes('locked')) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'CONVERSATION_LOCKED',
          message: error.message,
        },
      });
    }

    res.status(400).json({
      ok: false,
      error: {
        code: 'MESSAGE_SEND_FAILED',
        message: error.message,
      },
    });
  }
}

/**
 * Get messages in a conversation
 */
async function getMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const userId = req.user.uid;
    const { cursor, pageSize = 50, order = 'desc' } = req.query;

    const result = await messagesService.getMessages(conversationId, userId, {
      cursor,
      pageSize: parseInt(pageSize),
      order,
    });

    res.json({
      ok: true,
      data: result.messages,
      meta: result.meta,
    });
  } catch (error) {
    logger.error('Failed to get messages', {
      error: error.message,
      conversationId: req.params.conversationId,
      userId: req.user.uid,
      query: req.query,
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
        message: 'Failed to retrieve messages',
      },
    });
  }
}

/**
 * Edit a message
 */
async function editMessage(req, res) {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user.uid;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Text content is required',
        },
      });
    }

    const message = await messagesService.editMessage(id, userId, text);

    res.json({
      ok: true,
      data: message,
    });
  } catch (error) {
    logger.error('Failed to edit message', {
      error: error.message,
      messageId: req.params.id,
      userId: req.user.uid,
      text: req.body.text,
    });

    if (error.message.includes('only edit your own')) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'NOT_AUTHOR',
          message: error.message,
        },
      });
    }

    if (error.message.includes('within 15 minutes')) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EDIT_WINDOW_EXPIRED',
          message: error.message,
        },
      });
    }

    if (error.message.includes('deleted')) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'MESSAGE_DELETED',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to edit message',
      },
    });
  }
}

/**
 * Delete a message
 */
async function deleteMessage(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    await messagesService.deleteMessage(id, userId);

    res.json({
      ok: true,
      data: { success: true },
    });
  } catch (error) {
    logger.error('Failed to delete message', {
      error: error.message,
      messageId: req.params.id,
      userId: req.user.uid,
    });

    if (error.message.includes('only delete your own')) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: error.message,
        },
      });
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete message',
      },
    });
  }
}

/**
 * Add reaction to a message
 */
async function addReaction(req, res) {
  try {
    const { id } = req.params;
    const { value } = req.body;
    const userId = req.user.uid;

    if (!value || typeof value !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Reaction value is required',
        },
      });
    }

    const reaction = await messagesService.addReaction(id, userId, value);

    res.status(201).json({
      ok: true,
      data: reaction,
    });
  } catch (error) {
    logger.error('Failed to add reaction', {
      error: error.message,
      messageId: req.params.id,
      userId: req.user.uid,
      value: req.body.value,
    });

    res.status(400).json({
      ok: false,
      error: {
        code: 'REACTION_ADD_FAILED',
        message: error.message,
      },
    });
  }
}

/**
 * Remove reaction from a message
 */
async function removeReaction(req, res) {
  try {
    const { id, value } = req.params;
    const userId = req.user.uid;

    await messagesService.removeReaction(id, userId, value);

    res.json({
      ok: true,
      data: { success: true },
    });
  } catch (error) {
    logger.error('Failed to remove reaction', {
      error: error.message,
      messageId: req.params.id,
      userId: req.user.uid,
      value: req.params.value,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to remove reaction',
      },
    });
  }
}

module.exports = {
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
};
