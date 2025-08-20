const { getFirestore } = require('firebase-admin/firestore');
const { createModuleLogger } = require('../../../lib/logger');
const { canSendMessage, canEditMessage, canDeleteMessage } = require('../../../lib/chat/permissions');
const { sanitizeChatText, buildMessagePreview } = require('../../../lib/chat/sanitize');
const { buildMessageSummary } = require('../../../lib/chat/preview');
const { generateCursor, parseCursor } = require('../../../lib/ranking');
const reactionsService = require('../reactions/service');

const db = getFirestore();
const logger = createModuleLogger('chat:messages:service');

/**
 * Send a message in a conversation
 * @param {Object} data - Message data
 * @param {string} data.conversationId - Conversation ID
 * @param {string} data.authorId - Author user ID
 * @param {string} data.type - Message type ('text', 'image', 'audio')
 * @param {string} data.text - Message text (for text messages)
 * @param {Object} data.media - Media information (for media messages)
 * @returns {Promise<Object>} Created message
 */
async function sendMessage(data) {
  const { conversationId, authorId, type, text, media } = data;
  
  try {
    // Check if user can send message
    const permissionCheck = await canSendMessage(authorId, conversationId);
    if (!permissionCheck.allowed) {
      throw new Error(permissionCheck.message);
    }

    // Validate message data
    if (!type || !['text', 'image', 'audio'].includes(type)) {
      throw new Error('Invalid message type');
    }

    if (type === 'text' && !text) {
      throw new Error('Text messages require text content');
    }

    if (type !== 'text' && !media) {
      throw new Error('Media messages require media information');
    }

    // Sanitize text if present
    let sanitizedText = '';
    if (text) {
      sanitizedText = sanitizeChatText(text);
      if (!sanitizedText) {
        throw new Error('Message text cannot be empty after sanitization');
      }
    }

    // Create message document
    const messageData = {
      conversationId,
      authorId,
      type,
      text: sanitizedText,
      media: media || null,
      createdAt: new Date(),
      editedAt: null,
      isDeleted: false,
      deletedByMod: false,
      replyToMessageId: null, // TODO: Implement reply functionality
      mentions: [], // TODO: Implement mentions functionality
    };

    // Use transaction to ensure consistency
    const result = await db.runTransaction(async (transaction) => {
      // Create message
      const messageRef = db.collection('messages').doc();
      transaction.set(messageRef, messageData);

      // Update conversation metadata
      const conversationRef = db.collection('conversations').doc(conversationId);
      transaction.update(conversationRef, {
        lastMessageAt: messageData.createdAt,
        lastMessagePreview: buildMessagePreview(sanitizedText, 100),
      });

      // Update author's last read timestamp
      const participantRef = db
        .collection('conversations')
        .doc(conversationId)
        .collection('participants')
        .doc(authorId);
      
      transaction.update(participantRef, {
        lastReadAt: messageData.createdAt,
      });

      return messageRef.id;
    });

    // Get the created message with ID
    const message = {
      id: result,
      ...messageData,
    };

    logger.info('Message sent successfully', {
      messageId: result,
      conversationId,
      authorId,
      type,
    });

    return message;
  } catch (error) {
    logger.error('Failed to send message', {
      error: error.message,
      data,
    });
    throw error;
  }
}

/**
 * Get messages in a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID requesting messages
 * @param {Object} options - Query options
 * @param {string} options.cursor - Cursor for pagination
 * @param {number} options.pageSize - Number of messages to return
 * @param {string} options.order - Sort order ('asc' or 'desc')
 * @returns {Promise<Object>} Messages list with pagination
 */
async function getMessages(conversationId, userId, options = {}) {
  const { cursor, pageSize = 50, order = 'desc' } = options;
  
  try {
    // Check if user is a participant
    const participant = await db
      .collection('conversations')
      .doc(conversationId)
      .collection('participants')
      .doc(userId)
      .get();

    if (!participant.exists) {
      throw new Error('User is not a participant in this conversation');
    }

    // Build query
    let query = db
      .collection('messages')
      .where('conversationId', '==', conversationId)
      .where('isDeleted', '==', false);

    // Apply cursor if provided
    if (cursor) {
      const cursorData = parseCursor(cursor);
      if (cursorData.createdAt) {
        if (order === 'asc') {
          query = query.where('createdAt', '>', cursorData.createdAt);
        } else {
          query = query.where('createdAt', '<', cursorData.createdAt);
        }
      }
    }

    // Apply ordering and limit
    query = query.orderBy('createdAt', order === 'asc' ? 'asc' : 'desc');
    query = query.limit(pageSize + 1);

    const messagesSnapshot = await query.get();
    
    const messages = [];
    let hasMore = false;

    for (let i = 0; i < messagesSnapshot.docs.length; i++) {
      if (i >= pageSize) {
        hasMore = true;
        break;
      }

      const doc = messagesSnapshot.docs[i];
      const messageData = doc.data();
      
      // Get author details
      let author = null;
      try {
        const authorDoc = await db.collection('users').doc(messageData.authorId).get();
        if (authorDoc.exists) {
          author = authorDoc.data();
        }
      } catch (error) {
        logger.warn('Failed to fetch author details', { 
          authorId: messageData.authorId, 
          error: error.message 
        });
      }

      const message = buildMessageSummary(
        { id: doc.id, ...messageData },
        author
      );
      
      messages.push(message);
    }

    // Generate next cursor
    let nextCursor = null;
    if (hasMore && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      nextCursor = generateCursor(lastMessage, 'createdAt');
    }

    return {
      messages,
      meta: {
        hasMore,
        nextCursor,
        conversationId,
        order,
      },
    };
  } catch (error) {
    logger.error('Failed to get messages', {
      error: error.message,
      conversationId,
      userId,
      options,
    });
    throw error;
  }
}

/**
 * Edit a message
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID editing the message
 * @param {string} newText - New text content
 * @returns {Promise<Object>} Updated message
 */
async function editMessage(messageId, userId, newText) {
  try {
    // Check if user can edit message
    const permissionCheck = await canEditMessage(userId, messageId);
    if (!permissionCheck.allowed) {
      throw new Error(permissionCheck.message);
    }

    // Sanitize new text
    const sanitizedText = sanitizeChatText(newText);
    if (!sanitizedText) {
      throw new Error('Message text cannot be empty after sanitization');
    }

    // Update message
    const messageRef = db.collection('messages').doc(messageId);
    await messageRef.update({
      text: sanitizedText,
      editedAt: new Date(),
    });

    // Get updated message
    const updatedDoc = await messageRef.get();
    const message = {
      id: messageId,
      ...updatedDoc.data(),
    };

    logger.info('Message edited successfully', {
      messageId,
      userId,
      originalText: permissionCheck.message.text,
      newText: sanitizedText,
    });

    return message;
  } catch (error) {
    logger.error('Failed to edit message', {
      error: error.message,
      messageId,
      userId,
      newText,
    });
    throw error;
  }
}

/**
 * Delete a message (soft delete)
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID deleting the message
 * @returns {Promise<boolean>} Success status
 */
async function deleteMessage(messageId, userId) {
  try {
    // Check if user can delete message
    const permissionCheck = await canDeleteMessage(userId, messageId);
    if (!permissionCheck.allowed) {
      throw new Error(permissionCheck.message);
    }

    // Soft delete the message
    const messageRef = db.collection('messages').doc(messageId);
    const updateData = {
      isDeleted: true,
      deletedAt: new Date(),
    };

    // If deleted by moderator, mark it
    if (permissionCheck.message.authorId !== userId) {
      updateData.deletedByMod = true;
    }

    await messageRef.update(updateData);

    logger.info('Message deleted successfully', {
      messageId,
      userId,
      deletedByMod: updateData.deletedByMod,
    });

    return true;
  } catch (error) {
    logger.error('Failed to delete message', {
      error: error.message,
      messageId,
      userId,
    });
    throw error;
  }
}

/**
 * Add reaction to a message
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID adding reaction
 * @param {string} value - Reaction emoji
 * @returns {Promise<Object>} Reaction data
 */
async function addReaction(messageId, userId, value) {
  return reactionsService.addReaction(messageId, userId, value);
}

/**
 * Remove reaction from a message
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID removing reaction
 * @param {string} value - Reaction emoji
 * @returns {Promise<boolean>} Success status
 */
async function removeReaction(messageId, userId, value) {
  return reactionsService.removeReaction(messageId, userId, value);
}

module.exports = {
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
};
