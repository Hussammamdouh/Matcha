const { getStorage } = require('firebase-admin/storage');
const { createRequestLogger } = require('./logger');

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file types
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
];

/**
 * Generate signed URL for avatar upload
 * @param {string} userId - User ID
 * @param {string} fileName - File name with extension
 * @param {string} contentType - MIME type
 * @returns {Object} Signed URL and metadata
 */
async function generateAvatarUploadUrl(userId, fileName, contentType) {
  const logger = createRequestLogger();
  
  try {
    // Validate file type
    if (!ALLOWED_TYPES.includes(contentType)) {
      throw new Error(`Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`);
    }

    // Validate file extension
    const extension = fileName.split('.').pop()?.toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
    if (!validExtensions.includes(extension)) {
      throw new Error(`Invalid file extension. Allowed extensions: ${validExtensions.join(', ')}`);
    }

    const storage = getStorage();
    const bucket = storage.bucket();
    
    // Create file path: avatars/{userId}/{timestamp}_{random}.{extension}
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const filePath = `avatars/${userId}/${timestamp}_${random}.${extension}`;
    
    // Generate signed URL for upload
    const [signedUrl] = await bucket.file(filePath).getSignedUrl({
      action: 'write',
      contentType,
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      conditions: [
        ['content-length-range', 0, MAX_FILE_SIZE],
        ['starts-with', '$Content-Type', 'image/'],
      ],
    });

    logger.info('Avatar upload URL generated', {
      userId,
      filePath,
      contentType,
      expiresIn: '15 minutes',
    });

    return {
      uploadUrl: signedUrl,
      filePath,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  } catch (error) {
    logger.error('Failed to generate avatar upload URL', {
      error: error.message,
      userId,
      fileName,
      contentType,
    });
    throw error;
  }
}

/**
 * Get public URL for avatar
 * @param {string} filePath - File path in storage
 * @returns {string} Public URL
 */
function getAvatarPublicUrl(filePath) {
  const storage = getStorage();
  const bucket = storage.bucket();
  
  // Make the file publicly readable
  return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
}

/**
 * Delete avatar file
 * @param {string} filePath - File path in storage
 * @returns {Promise<void>}
 */
async function deleteAvatar(filePath) {
  const logger = createRequestLogger();
  
  try {
    const storage = getStorage();
    const bucket = storage.bucket();
    
    await bucket.file(filePath).delete();
    
    logger.info('Avatar file deleted', {
      filePath,
    });
  } catch (error) {
    logger.error('Failed to delete avatar file', {
      error: error.message,
      filePath,
    });
    throw error;
  }
}

/**
 * Validate uploaded file
 * @param {Object} file - File object from multer
 * @returns {Object} Validation result
 */
function validateAvatarFile(file) {
  const errors = [];
  
  if (!file) {
    errors.push('No file provided');
    return { isValid: false, errors };
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }
  
  // Check file type
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    errors.push(`Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`);
  }
  
  // Check file extension
  const extension = file.originalname.split('.').pop()?.toLowerCase();
  const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
  if (!validExtensions.includes(extension)) {
    errors.push(`Invalid file extension. Allowed extensions: ${validExtensions.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = {
  generateAvatarUploadUrl,
  getAvatarPublicUrl,
  deleteAvatar,
  validateAvatarFile,
  MAX_FILE_SIZE,
  ALLOWED_TYPES,
};

