const { getFirestore } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../../lib/logger');
const { canSendMessage, canEditMessage, canDeleteMessage } = require('../../../lib/chat/permissions');
const { sanitizeChatText, buildMessagePreview } = require('../../../lib/chat/sanitize');
const { buildMessageSummary } = require('../../../lib/chat/preview');
const { generateCursor, parseCursor } = require('../../../lib/ranking');
const reactionsService = require('../reactions/service');

let db;
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
  db = db || getFirestore();
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
  db = db || getFirestore();
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

    // Index-safe: fetch by conversationId only, then sort and paginate in memory
    const snapshot = await db
      .collection('messages')
      .where('conversationId', '==', conversationId)
      .limit(500)
      .get();

    // Map and filter deleted
    let items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(m => !m.isDeleted);

    // Sort by createdAt in requested order
    items.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return order === 'asc' ? ta - tb : tb - ta;
    });

    // In-memory cursor by id or timestamp
    if (cursor) {
      const cursorData = parseCursor(cursor);
      if (cursorData?.id) {
        const idx = items.findIndex(m => m.id === cursorData.id);
        if (idx >= 0) items = items.slice(idx + 1);
      } else if (cursorData?.createdAt) {
        const cTime = cursorData.createdAt?.toMillis ? cursorData.createdAt.toMillis() : new Date(cursorData.createdAt).getTime();
        items = items.filter(m => {
          const t = m.createdAt?.toMillis ? m.createdAt.toMillis() : new Date(m.createdAt || 0).getTime();
          return order === 'asc' ? t > cTime : t < cTime;
        });
      }
    }

    const page = items.slice(0, pageSize);
    const hasMore = items.length > pageSize;

    // Hydrate author details
    const messages = [];
    for (const m of page) {
      let author = null;
      try {
        const authorDoc = await db.collection('users').doc(m.authorId).get();
        if (authorDoc.exists) author = authorDoc.data();
      } catch (error) {
        logger.warn('Failed to fetch author details', { authorId: m.authorId, error: error.message });
      }
      messages.push(buildMessageSummary(m, author));
    }

    let nextCursor = null;
    if (hasMore && page.length > 0) {
      nextCursor = generateCursor(page[page.length - 1], 'createdAt');
    }

    return { messages, meta: { hasMore, nextCursor, conversationId, order } };
  } catch (error) {
    const context = { error: error.message, conversationId, userId, options };
    if (String(error.message || '').includes('not a participant')) {
      logger.warn('Skipping messages fetch for non-participant', context);
    } else {
      logger.error('Failed to get messages', context);
    }
    // Resilient fallback: empty list instead of error
    return { messages: [], meta: { hasMore: false, nextCursor: null, conversationId, order } };
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
  db = db || getFirestore();
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
  db = db || getFirestore();
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

    // Best-effort: delete message media from storage if present
    try {
      const snap = await messageRef.get();
      const data = snap.exists ? snap.data() : null;
      if (data && data.media && (data.media.objectPath || data.media.url)) {
        const { getProvider } = require('../../../lib/storageProvider');
        const provider = getProvider();

        function extractObjectPathFromUrl(url) {
          try {
            if (!url || typeof url !== 'string') return null;
            if (url.includes('res.cloudinary.com')) {
              const idx = url.indexOf('/upload/');
              if (idx !== -1) {
                const after = url.substring(idx + '/upload/'.length);
                const parts = after.split('/');
                const maybeVersion = parts[0];
                const startIndex = /^v\d+$/.test(maybeVersion) ? 1 : 0;
                const pathParts = parts.slice(startIndex);
                const last = pathParts.pop() || '';
                const withoutExt = last.includes('.') ? last.substring(0, last.lastIndexOf('.')) : last;
                const publicId = [...pathParts, withoutExt].join('/');
                return publicId || null;
              }
            }
            if (url.includes('storage.googleapis.com')) {
              const u = new URL(url);
              const segments = u.pathname.split('/').filter(Boolean);
              if (segments.length >= 2) {
                return decodeURIComponent(segments.slice(1).join('/'));
              }
            }
            if (url.startsWith('gs://')) {
              const pathStart = url.indexOf('/', 'gs://'.length);
              if (pathStart > 0) return url.substring(pathStart + 1);
            }
            return null;
          } catch (_) {
            return null;
          }
        }

        const objectPath = data.media.objectPath || extractObjectPathFromUrl(data.media.url);
        if (objectPath) {
          await provider.deleteFile(objectPath).catch(() => {});
        }
      }
    } catch (e) {
      logger.warn('Failed to delete chat message media (continuing)', { messageId, error: e.message });
    }

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
