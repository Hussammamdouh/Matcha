const { getStorage } = require('../firebase');
const { features } = require('../config');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger();

/**
 * Media validation and storage utilities for Matcha
 * Handles Firebase Storage signed URLs and content validation
 */

// Media type configurations
const MEDIA_CONFIG = {
  images: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
  },
  audio: {
    allowedTypes: ['audio/mpeg', 'audio/aac', 'audio/webm'],
    maxSize: 20 * 1024 * 1024, // 20MB
    extensions: ['.mp3', '.aac', '.webm'],
  },
};

/**
 * Validate media file type and size
 *
 * @param {string} mimeType - MIME type of the file
 * @param {number} size - File size in bytes
 * @param {string} mediaType - Type of media: 'image' or 'audio'
 * @returns {Object} Validation result with isValid and error message
 */
function validateMedia(mimeType, size, mediaType) {
  // Check if voice posts are enabled for audio
  if (mediaType === 'audio' && !features.voicePosts) {
    return {
      isValid: false,
      error: 'Voice posts are currently disabled',
    };
  }

  const config = MEDIA_CONFIG[mediaType === 'audio' ? 'audio' : 'images'];

  // Validate MIME type
  if (!config.allowedTypes.includes(mimeType)) {
    return {
      isValid: false,
      error: `Invalid MIME type. Allowed: ${config.allowedTypes.join(', ')}`,
    };
  }

  // Validate file size
  if (size > config.maxSize) {
    const maxSizeMB = config.maxSize / (1024 * 1024);
    return {
      isValid: false,
      error: `File too large. Maximum size: ${maxSizeMB}MB`,
    };
  }

  return { isValid: true };
}

/**
 * Generate signed URL for file upload
 *
 * @param {string} filePath - Storage path for the file
 * @param {string} mimeType - MIME type of the file
 * @param {string} intent - Upload intent: 'post', 'comment', 'avatar'
 * @param {number} expiresIn - Expiration time in seconds (default: 15 minutes)
 * @returns {Object} Signed URL and metadata
 */
async function generateSignedUrl(filePath, mimeType, intent, expiresIn = 900) {
  try {
    const storage = getStorage();
    const bucket = storage.bucket();

    // Validate intent
    const validIntents = ['post', 'comment', 'avatar'];
    if (!validIntents.includes(intent)) {
      throw new Error(`Invalid upload intent: ${intent}`);
    }

    // Validate media type for the intent
    if (intent === 'avatar') {
      const imageValidation = validateMedia(mimeType, 0, 'image');
      if (!imageValidation.isValid) {
        throw new Error(imageValidation.error);
      }
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = mimeType.split('/')[1];
    const fileName = `${timestamp}_${randomId}.${extension}`;

    // Construct full path
    const fullPath = `${filePath}/${fileName}`;

    // Generate signed URL for PUT operation
    const [url] = await bucket.file(fullPath).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresIn * 1000,
      contentType: mimeType,
      conditions: [
        ['content-length-range', 0, MEDIA_CONFIG.images.maxSize], // Use max image size as upper bound
      ],
    });

    logger.info('Generated signed URL for file upload', {
      filePath: fullPath,
      intent,
      mimeType,
      expiresIn,
    });

    return {
      signedUrl: url,
      filePath: fullPath,
      fileName,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  } catch (error) {
    logger.error('Failed to generate signed URL', {
      error: error.message,
      filePath,
      intent,
      mimeType,
    });
    throw error;
  }
}

/**
 * Generate signed URL for file download/viewing
 *
 * @param {string} filePath - Storage path of the file
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {string} Signed URL for file access
 */
async function generateDownloadUrl(filePath, expiresIn = 3600) {
  try {
    const storage = getStorage();
    const bucket = storage.bucket();

    const [url] = await bucket.file(filePath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });

    return url;
  } catch (error) {
    logger.error('Failed to generate download URL', {
      error: error.message,
      filePath,
    });
    throw error;
  }
}

/**
 * Delete file from storage
 *
 * @param {string} filePath - Storage path of the file to delete
 * @returns {boolean} Success status
 */
async function deleteFile(filePath) {
  try {
    const storage = getStorage();
    const bucket = storage.bucket();

    await bucket.file(filePath).delete();

    logger.info('File deleted from storage', { filePath });
    return true;
  } catch (error) {
    logger.error('Failed to delete file from storage', {
      error: error.message,
      filePath,
    });
    return false;
  }
}

/**
 * Get file metadata
 *
 * @param {string} filePath - Storage path of the file
 * @returns {Object|null} File metadata or null if not found
 */
async function getFileMetadata(filePath) {
  try {
    const storage = getStorage();
    const bucket = storage.bucket();

    const [metadata] = await bucket.file(filePath).getMetadata();

    return {
      name: metadata.name,
      size: parseInt(metadata.size),
      contentType: metadata.contentType,
      timeCreated: metadata.timeCreated,
      updated: metadata.updated,
      md5Hash: metadata.md5Hash,
    };
  } catch (error) {
    logger.error('Failed to get file metadata', {
      error: error.message,
      filePath,
    });
    return null;
  }
}

/**
 * Check if file exists in storage
 *
 * @param {string} filePath - Storage path of the file
 * @returns {boolean} True if file exists
 */
async function fileExists(filePath) {
  try {
    const storage = getStorage();
    const bucket = storage.bucket();

    const [exists] = await bucket.file(filePath).exists();
    return exists;
  } catch (error) {
    logger.error('Failed to check file existence', {
      error: error.message,
      filePath,
    });
    return false;
  }
}

/**
 * Generate storage path for different content types
 *
 * @param {string} contentType - Type of content: 'post', 'comment', 'avatar'
 * @param {string} contentId - ID of the post, comment, or user
 * @returns {string} Storage path
 */
function generateStoragePath(contentType, contentId) {
  switch (contentType) {
    case 'post':
      return `posts/${contentId}`;
    case 'comment':
      return `comments/${contentId}`;
    case 'avatar':
      return `avatars/${contentId}`;
    default:
      throw new Error(`Invalid content type: ${contentType}`);
  }
}

module.exports = {
  validateMedia,
  generateSignedUrl,
  generateDownloadUrl,
  deleteFile,
  getFileMetadata,
  fileExists,
  generateStoragePath,
  MEDIA_CONFIG,
};
