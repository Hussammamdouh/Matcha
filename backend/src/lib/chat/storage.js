const { getStorage } = require('../firebase');
const { createModuleLogger } = require('../logger');

const storage = getStorage();
const bucket = storage.bucket();
const logger = createModuleLogger('chat:storage');

/**
 * Chat media validation configuration
 */
function getChatMediaConfig() {
  const { features } = require('../../config/features');
  
  return {
    images: {
      mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxSize: 5 * 1024 * 1024, // 5MB
      folder: 'chat/conversations',
    },
    audio: {
      mimeTypes: ['audio/mpeg', 'audio/aac', 'audio/webm'],
      maxSize: 20 * 1024 * 1024, // 20MB
      folder: 'chat/conversations',
      enabled: features.chatAudio,
    },
  };
}

/**
 * Validate chat media upload
 * @param {string} mimeType - MIME type
 * @param {number} size - File size in bytes
 * @param {string} type - Media type ('image' or 'audio')
 * @returns {Object} Validation result
 */
function validateChatMedia(mimeType, size, type) {
  const config = getChatMediaConfig()[type];
  
  if (!config) {
    return {
      valid: false,
      error: `Unsupported media type: ${type}`,
    };
  }

  if (!config.enabled) {
    return {
      valid: false,
      error: `${type} messages are disabled`,
    };
  }

  if (!config.mimeTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `Unsupported MIME type: ${mimeType}. Allowed: ${config.mimeTypes.join(', ')}`,
    };
  }

  if (size > config.maxSize) {
    const maxSizeMB = config.maxSize / (1024 * 1024);
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Generate signed upload URL for chat media
 * @param {string} conversationId - Conversation ID
 * @param {string} messageId - Message ID
 * @param {string} mimeType - MIME type
 * @param {string} extension - File extension
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Object} Signed URL and metadata
 */
async function generateChatUploadUrl(conversationId, messageId, mimeType, extension, expiresIn = 3600) {
  try {
    const uuid = require('uuid').v4();
    const fileName = `${uuid}.${extension}`;
    const filePath = `chat/conversations/${conversationId}/messages/${messageId}/${fileName}`;
    
    const [url] = await bucket.file(filePath).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + (expiresIn * 1000),
      contentType: mimeType,
    });

    logger.info('Generated chat upload URL', {
      conversationId,
      messageId,
      filePath,
      mimeType,
      expiresIn,
    });

    return {
      url,
      objectPath: filePath,
      expiresAt: new Date(Date.now() + (expiresIn * 1000)),
      headers: {
        'Content-Type': mimeType,
      },
    };
  } catch (error) {
    logger.error('Failed to generate chat upload URL', {
      error: error.message,
      conversationId,
      messageId,
      mimeType,
    });
    throw error;
  }
}

/**
 * Generate signed download URL for chat media
 * @param {string} objectPath - Storage object path
 * @param {number} expiresIn - Expiration time in seconds (default: 24 hours)
 * @returns {string} Signed download URL
 */
async function generateChatDownloadUrl(objectPath, expiresIn = 86400) {
  try {
    const [url] = await bucket.file(objectPath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + (expiresIn * 1000),
    });

    return url;
  } catch (error) {
    logger.error('Failed to generate chat download URL', {
      error: error.message,
      objectPath,
    });
    throw error;
  }
}

/**
 * Delete chat media file
 * @param {string} objectPath - Storage object path
 * @returns {boolean} Success status
 */
async function deleteChatMedia(objectPath) {
  try {
    await bucket.file(objectPath).delete();
    logger.info('Deleted chat media file', { objectPath });
    return true;
  } catch (error) {
    logger.error('Failed to delete chat media file', {
      error: error.message,
      objectPath,
    });
    return false;
  }
}

/**
 * Get chat media file metadata
 * @param {string} objectPath - Storage object path
 * @returns {Object} File metadata
 */
async function getChatMediaMetadata(objectPath) {
  try {
    const [metadata] = await bucket.file(objectPath).getMetadata();
    return {
      size: parseInt(metadata.size),
      mimeType: metadata.contentType,
      createdAt: metadata.timeCreated,
      updatedAt: metadata.updated,
    };
  } catch (error) {
    logger.error('Failed to get chat media metadata', {
      error: error.message,
      objectPath,
    });
    throw error;
  }
}

module.exports = {
  validateChatMedia,
  generateChatUploadUrl,
  generateChatDownloadUrl,
  deleteChatMedia,
  getChatMediaMetadata,
};
