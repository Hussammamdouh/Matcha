const { createRequestLogger } = require('../../../lib/logger');
const unifiedChatService = require('./service');

/**
 * Unified Chat Controller
 * Provides simplified REST API for mobile integration
 */

/**
 * Create or get conversation
 * POST /api/v1/chat/conversation
 */
async function createOrGetConversation(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const { participantIds, type = 'direct', title = null } = req.body;
    const userId = req.user.uid;

    if (!participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_REQUEST', message: 'participantIds array is required' }
      });
    }

    const conversation = await unifiedChatService.createOrGetConversation(
      userId, 
      participantIds, 
      type, 
      title
    );

    res.status(201).json({
      ok: true,
      data: conversation,
    });
  } catch (error) {
    logger.error('Failed to create/get conversation', { error: error.message });
    res.status(500).json({
      ok: false,
      error: { code: 'CONVERSATION_FAILED', message: error.message }
    });
  }
}

/**
 * Get conversation with full message history
 * GET /api/v1/chat/conversation/:id
 */
async function getConversation(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const { id } = req.params;
    const { limit = 50, cursor = null } = req.query;
    const userId = req.user.uid;

    const conversation = await unifiedChatService.getConversationWithMessages(
      id, 
      userId, 
      { limit: parseInt(limit), cursor }
    );

    res.json({
      ok: true,
      data: conversation,
    });
  } catch (error) {
    logger.error('Failed to get conversation', { error: error.message });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' }
      });
    }
    
    if (error.message.includes('not a participant')) {
      return res.status(403).json({
        ok: false,
        error: { code: 'NOT_PARTICIPANT', message: 'Access denied' }
      });
    }

    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get conversation' }
    });
  }
}

/**
 * Send message
 * POST /api/v1/chat/conversation/:id/message
 */
async function sendMessage(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const { id } = req.params;
    const { type = 'text', text = '', media = null, replyTo = null } = req.body;
    const userId = req.user.uid;

    // Determine message type based on media presence
    let messageType = type;
    let messageText = text;
    let messageMedia = media;

    // If media is uploaded via directUpload middleware, adjust the message type
    if (Array.isArray(media) && media.length > 0) {
      messageType = media[0].type || 'image';
      // If no text provided but media exists, use a default text
      if (!messageText && messageType === 'image') {
        messageText = '📷 Photo';
      } else if (!messageText && messageType === 'audio') {
        messageText = '🎵 Audio';
      } else if (!messageText && messageType === 'video') {
        messageText = '🎥 Video';
      }
    }

    const message = await unifiedChatService.sendMessage(
      userId, 
      id, 
      { type: messageType, text: messageText, media: messageMedia, replyTo }
    );

    res.status(201).json({
      ok: true,
      data: message,
    });
  } catch (error) {
    logger.error('Failed to send message', { error: error.message });
    
    if (error.message.includes('not a participant')) {
      return res.status(403).json({
        ok: false,
        error: { code: 'NOT_PARTICIPANT', message: 'Access denied' }
      });
    }
    
    if (error.message.includes('cannot be empty')) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_MESSAGE', message: error.message }
      });
    }

    res.status(500).json({
      ok: false,
      error: { code: 'MESSAGE_FAILED', message: 'Failed to send message' }
    });
  }
}

/**
 * Get messages in conversation
 * GET /api/v1/chat/conversation/:id/messages
 */
async function getMessages(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const { id } = req.params;
    const { limit = 50, cursor = null, order = 'desc' } = req.query;
    const userId = req.user.uid;

    const result = await unifiedChatService.getMessages(
      id, 
      userId, 
      { limit: parseInt(limit), cursor, order }
    );

    res.json({
      ok: true,
      data: result.messages,
      meta: result.meta,
    });
  } catch (error) {
    logger.error('Failed to get messages', { error: error.message });
    
    if (error.message.includes('not a participant')) {
      return res.status(403).json({
        ok: false,
        error: { code: 'NOT_PARTICIPANT', message: 'Access denied' }
      });
    }

    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get messages' }
    });
  }
}

/**
 * Edit message
 * PATCH /api/v1/chat/message/:id
 */
async function editMessage(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user.uid;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_REQUEST', message: 'Text is required' }
      });
    }

    await unifiedChatService.editMessage(userId, id, text);

    res.json({
      ok: true,
      data: { success: true },
    });
  } catch (error) {
    logger.error('Failed to edit message', { error: error.message });
    
    if (error.message.includes('only edit your own')) {
      return res.status(403).json({
        ok: false,
        error: { code: 'NOT_AUTHOR', message: 'Can only edit your own messages' }
      });
    }
    
    if (error.message.includes('15 minutes')) {
      return res.status(400).json({
        ok: false,
        error: { code: 'EDIT_WINDOW_EXPIRED', message: error.message }
      });
    }

    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to edit message' }
    });
  }
}

/**
 * Delete message
 * DELETE /api/v1/chat/message/:id
 */
async function deleteMessage(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    await unifiedChatService.deleteMessage(userId, id);

    res.json({
      ok: true,
      data: { success: true },
    });
  } catch (error) {
    logger.error('Failed to delete message', { error: error.message });
    
    if (error.message.includes('only delete your own')) {
      return res.status(403).json({
        ok: false,
        error: { code: 'NOT_AUTHOR', message: 'Can only delete your own messages' }
      });
    }

    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete message' }
    });
  }
}

/**
 * Mark conversation as read
 * POST /api/v1/chat/conversation/:id/read
 */
async function markAsRead(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    await unifiedChatService.markAsRead(userId, id);

    res.json({
      ok: true,
      data: { success: true },
    });
  } catch (error) {
    logger.error('Failed to mark as read', { error: error.message });
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to mark as read' }
    });
  }
}

/**
 * Get user's conversations list
 * GET /api/v1/chat/conversations
 */
async function getConversations(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const { limit = 20, cursor = null } = req.query;
    const userId = req.user.uid;

    const result = await unifiedChatService.getUserConversations(
      userId, 
      { limit: parseInt(limit), cursor }
    );

    res.json({
      ok: true,
      data: result.conversations,
      meta: result.meta,
    });
  } catch (error) {
    logger.error('Failed to get conversations', { error: error.message });
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get conversations' }
    });
  }
}

/**
 * Update typing status
 * POST /api/v1/chat/conversation/:id/typing
 */
async function updateTyping(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const { id } = req.params;
    const { isTyping } = req.body;
    const userId = req.user.uid;

    if (typeof isTyping !== 'boolean') {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_REQUEST', message: 'isTyping must be boolean' }
      });
    }

    await unifiedChatService.updateTypingStatus(userId, id, isTyping);

    res.json({
      ok: true,
      data: { isTyping },
    });
  } catch (error) {
    logger.error('Failed to update typing status', { error: error.message });
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update typing status' }
    });
  }
}

/**
 * Get typing users for a conversation
 * GET /api/v1/chat/conversation/:id/typing
 */
async function getTypingUsers(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const { id } = req.params;
    const userIds = unifiedChatService.getTypingUsers(id);

    res.json({
      ok: true,
      data: { typingUsers: userIds },
    });
  } catch (error) {
    logger.error('Failed to get typing users', { error: error.message });
    res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get typing users' }
    });
  }
}

/**
 * Unified chat operation (for backward compatibility)
 * POST /api/v1/chat/operation
 */
async function unifiedOperation(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const { operation, data } = req.body;
    const userId = req.user.uid;

    switch (operation) {
      case 'create_conversation':
        return await createOrGetConversation({ 
          body: data, 
          user: { uid: userId }, 
          id: req.id 
        }, res);

      case 'get_conversation':
        return await getConversation({ 
          params: { id: data.conversationId }, 
          query: data, 
          user: { uid: userId }, 
          id: req.id 
        }, res);

      case 'send_message':
        // Handle media uploads in unified operation
        if (Array.isArray(data.media) && data.media.length > 0) {
          data.type = data.media[0].type || 'image';
          if (!data.text && data.type === 'image') {
            data.text = '📷 Photo';
          } else if (!data.text && data.type === 'audio') {
            data.text = '🎵 Audio';
          } else if (!data.text && data.type === 'video') {
            data.text = '🎥 Video';
          }
        }
        return await sendMessage({ 
          params: { id: data.conversationId }, 
          body: data, 
          user: { uid: userId }, 
          id: req.id 
        }, res);

      case 'get_messages':
        return await getMessages({ 
          params: { id: data.conversationId }, 
          query: data, 
          user: { uid: userId }, 
          id: req.id 
        }, res);

      case 'edit_message':
        return await editMessage({ 
          params: { id: data.messageId }, 
          body: data, 
          user: { uid: userId }, 
          id: req.id 
        }, res);

      case 'delete_message':
        return await deleteMessage({ 
          params: { id: data.messageId }, 
          user: { uid: userId }, 
          id: req.id 
        }, res);

      case 'mark_read':
        return await markAsRead({ 
          params: { id: data.conversationId }, 
          user: { uid: userId }, 
          id: req.id 
        }, res);

      case 'get_conversations':
        return await getConversations({ 
          query: data, 
          user: { uid: userId }, 
          id: req.id 
        }, res);

      case 'update_typing':
        return await updateTyping({ 
          params: { id: data.conversationId }, 
          body: data, 
          user: { uid: userId }, 
          id: req.id 
        }, res);

      default:
        return res.status(400).json({
          ok: false,
          error: { 
            code: 'INVALID_OPERATION', 
            message: `Unknown operation: ${operation}` 
          }
        });
    }
  } catch (error) {
    logger.error('Unified operation failed', { error: error.message });
    res.status(500).json({
      ok: false,
      error: { code: 'OPERATION_FAILED', message: 'Operation failed' }
    });
  }
}

module.exports = {
  createOrGetConversation,
  getConversation,
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
  markAsRead,
  getConversations,
  updateTyping,
  getTypingUsers,
  unifiedOperation,
};
