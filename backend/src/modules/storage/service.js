const { createModuleLogger } = require('../../lib/logger');
const { validateMedia } = require('../../lib/storage');
const { getProvider } = require('../../lib/storageProvider');
const logger = createModuleLogger();

/**
 * Generate signed URL for file upload
 * @param {string} filePath - File path in storage
 * @param {string} contentType - MIME type of the file
 * @param {number} expiresIn - Expiration time in seconds
 * @returns {Object} Upload URL and metadata
 */
async function generateUploadUrl(filePath, contentType, expiresIn = 3600) {
  try {
    // Validate file path and content type
    const validation = validateMedia(filePath, contentType);
    if (!validation.isValid) {
      throw new Error(`Invalid file: ${validation.error}`);
    }

    const provider = getProvider();
    const result = await provider.generateUploadUrl(filePath, contentType, expiresIn);

    logger.info('Upload URL generated', {
      filePath,
      contentType,
      expiresIn,
    });

    return result;
  } catch (error) {
    logger.error('Failed to generate upload URL', {
      error: error.message,
      filePath,
      contentType,
    });
    throw error;
  }
}

/**
 * Generate signed URL for file download
 * @param {string} filePath - File path in storage
 * @param {number} expiresIn - Expiration time in seconds
 * @returns {Object} Download URL and metadata
 */
async function generateDownloadUrl(filePath, expiresIn = 3600) {
  try {
    const provider = getProvider();
    const { downloadUrl: url, contentType, size, expiresAt } = await provider.generateDownloadUrl(filePath, expiresIn);

    logger.info('Download URL generated', {
      filePath,
      expiresIn,
      size: metadata.size,
    });

    return {
      downloadUrl: url,
      filePath,
      contentType,
      size,
      expiresAt,
    };
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
 * @param {string} filePath - File path in storage
 * @returns {boolean} True if deleted successfully
 */
async function deleteFile(filePath) {
  try {
    const provider = getProvider();
    const deleted = await provider.deleteFile(filePath);

    logger.info('File deleted successfully', { filePath });

    return deleted;
  } catch (error) {
    logger.error('Failed to delete file', {
      error: error.message,
      filePath,
    });
    throw error;
  }
}

/**
 * Get file metadata
 * @param {string} filePath - File path in storage
 * @returns {Object} File metadata
 */
async function getFileMetadata(filePath) {
  try {
    const provider = getProvider();
    const metadata = await provider.getFileMetadata(filePath);
    if (!metadata) throw new Error('File not found');

    logger.info('File metadata retrieved', {
      filePath,
      size: metadata.size,
      contentType: metadata.contentType,
    });

    return {
      filePath,
      contentType: metadata.contentType,
      size: metadata.size,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      md5Hash: metadata.md5Hash,
    };
  } catch (error) {
    logger.error('Failed to get file metadata', {
      error: error.message,
      filePath,
    });
    throw error;
  }
}

/**
 * Check if file exists
 * @param {string} filePath - File path in storage
 * @returns {boolean} True if file exists
 */
async function fileExists(filePath) {
  try {
    const provider = getProvider();
    return await provider.fileExists(filePath);
  } catch (error) {
    logger.error('Failed to check file existence', {
      error: error.message,
      filePath,
    });
    return false;
  }
}

/**
 * Get file size
 * @param {string} filePath - File path in storage
 * @returns {number} File size in bytes
 */
async function getFileSize(filePath) {
  try {
    const provider = getProvider();
    return await provider.getFileSize(filePath);
  } catch (error) {
    logger.error('Failed to get file size', {
      error: error.message,
      filePath,
    });
    throw error;
  }
}

/**
 * List files in a directory
 * @param {string} directory - Directory path
 * @param {Object} options - List options
 * @param {number} options.maxResults - Maximum number of results
 * @param {string} options.pageToken - Pagination token
 * @returns {Object} List of files with pagination
 */
async function listFiles(directory, options = {}) {
  try {
    const { maxResults = 1000, pageToken } = options;
    const provider = getProvider();
    const { files: fileList, nextPageToken } = await provider.listFiles(directory, { maxResults, pageToken });

    logger.info('Files listed successfully', {
      directory,
      count: fileList.length,
      hasNextPage: !!nextPageToken,
    });

    return {
      files: fileList,
      nextPageToken,
    };
  } catch (error) {
    logger.error('Failed to list files', {
      error: error.message,
      directory,
    });
    throw error;
  }
}

/**
 * Move file to new location
 * @param {string} sourcePath - Source file path
 * @param {string} destinationPath - Destination file path
 * @returns {boolean} True if moved successfully
 */
async function moveFile(sourcePath, destinationPath) {
  try {
    const sourceFile = bucket.file(sourcePath);
    const destinationFile = bucket.file(destinationPath);

    // Check if source file exists
    const [exists] = await sourceFile.exists();
    if (!exists) {
      throw new Error('Source file not found');
    }

    // Move the file
    await sourceFile.move(destinationFile);

    logger.info('File moved successfully', {
      sourcePath,
      destinationPath,
    });

    return true;
  } catch (error) {
    logger.error('Failed to move file', {
      error: error.message,
      sourcePath,
      destinationPath,
    });
    throw error;
  }
}

/**
 * Copy file to new location
 * @param {string} sourcePath - Source file path
 * @param {string} destinationPath - Destination file path
 * @returns {boolean} True if copied successfully
 */
async function copyFile(sourcePath, destinationPath) {
  try {
    const sourceFile = bucket.file(sourcePath);
    const destinationFile = bucket.file(destinationPath);

    // Check if source file exists
    const [exists] = await sourceFile.exists();
    if (!exists) {
      throw new Error('Source file not found');
    }

    // Copy the file
    await sourceFile.copy(destinationFile);

    logger.info('File copied successfully', {
      sourcePath,
      destinationPath,
    });

    return true;
  } catch (error) {
    logger.error('Failed to copy file', {
      error: error.message,
      sourcePath,
      destinationPath,
    });
    throw error;
  }
}

module.exports = {
  generateUploadUrl,
  generateDownloadUrl,
  deleteFile,
  getFileMetadata,
  fileExists,
  getFileSize,
  listFiles,
  moveFile,
  copyFile,
};
