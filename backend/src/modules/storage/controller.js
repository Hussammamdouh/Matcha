const { createModuleLogger } = require('../../lib/logger');
const storageService = require('./service');
const { validateChatMedia, generateChatUploadUrl } = require('../../lib/chat/storage');
const { isParticipant } = require('../../lib/chat/permissions');

const logger = createModuleLogger();

/**
 * Generate signed URL for file upload
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function generateUploadUrl(req, res) {
  try {
    const { filePath, contentType, expiresIn } = req.body;

    if (!filePath || !contentType) {
      return res.status(400).json({
        ok: false,
        error: 'File path and content type are required',
        code: 'MISSING_PARAMETERS',
      });
    }

    // Generate upload URL
    const result = await storageService.generateUploadUrl(filePath, contentType, expiresIn || 3600);

    logger.info('Upload URL generated for user', {
      userId: req.user.uid,
      filePath,
      contentType,
    });

    res.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to generate upload URL', {
      error: error.message,
      userId: req.user.uid,
      filePath: req.body.filePath,
    });

    if (error.message.includes('Invalid file')) {
      return res.status(400).json({
        ok: false,
        error: error.message,
        code: 'INVALID_FILE',
      });
    }

    res.status(500).json({
      ok: false,
      error: 'Failed to generate upload URL',
      code: 'UPLOAD_URL_ERROR',
    });
  }
}

/**
 * Generate signed URL for file download
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function generateDownloadUrl(req, res) {
  try {
    const { filePath, expiresIn } = req.body;

    if (!filePath) {
      return res.status(400).json({
        ok: false,
        error: 'File path is required',
        code: 'MISSING_FILE_PATH',
      });
    }

    // Generate download URL
    const result = await storageService.generateDownloadUrl(filePath, expiresIn || 3600);

    logger.info('Download URL generated for user', {
      userId: req.user.uid,
      filePath,
    });

    res.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to generate download URL', {
      error: error.message,
      userId: req.user.uid,
      filePath: req.body.filePath,
    });

    if (error.message.includes('File not found')) {
      return res.status(404).json({
        ok: false,
        error: 'File not found',
        code: 'FILE_NOT_FOUND',
      });
    }

    res.status(500).json({
      ok: false,
      error: 'Failed to generate download URL',
      code: 'DOWNLOAD_URL_ERROR',
    });
  }
}

/**
 * Delete file from storage
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteFile(req, res) {
  try {
    const { filePath } = req.params;

    if (!filePath) {
      return res.status(400).json({
        ok: false,
        error: 'File path is required',
        code: 'MISSING_FILE_PATH',
      });
    }

    // Check if user has permission to delete this file
    // TODO: Implement permission check based on file ownership
    // For now, allow any authenticated user to delete any file
    // In production, this should check if the user owns the file or has admin rights

    // Delete the file
    const deleted = await storageService.deleteFile(filePath);

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: 'File not found',
        code: 'FILE_NOT_FOUND',
      });
    }

    logger.info('File deleted by user', {
      userId: req.user.uid,
      filePath,
    });

    res.json({
      ok: true,
      data: {
        message: 'File deleted successfully',
        filePath,
      },
    });
  } catch (error) {
    logger.error('Failed to delete file', {
      error: error.message,
      userId: req.user.uid,
      filePath: req.params.filePath,
    });

    res.status(500).json({
      ok: false,
      error: 'Failed to delete file',
      code: 'DELETE_ERROR',
    });
  }
}

/**
 * Get file metadata
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getFileMetadata(req, res) {
  try {
    const { filePath } = req.params;

    if (!filePath) {
      return res.status(400).json({
        ok: false,
        error: 'File path is required',
        code: 'MISSING_FILE_PATH',
      });
    }

    // Get file metadata
    const metadata = await storageService.getFileMetadata(filePath);

    logger.info('File metadata retrieved by user', {
      userId: req.user.uid,
      filePath,
    });

    res.json({
      ok: true,
      data: metadata,
    });
  } catch (error) {
    logger.error('Failed to get file metadata', {
      error: error.message,
      userId: req.user.uid,
      filePath: req.params.filePath,
    });

    if (error.message.includes('File not found')) {
      return res.status(404).json({
        ok: false,
        error: 'File not found',
        code: 'FILE_NOT_FOUND',
      });
    }

    res.status(500).json({
      ok: false,
      error: 'Failed to get file metadata',
      code: 'METADATA_ERROR',
    });
  }
}

/**
 * Check if file exists
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function checkFileExists(req, res) {
  try {
    const { filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({
        ok: false,
        error: 'File path is required',
        code: 'MISSING_FILE_PATH',
      });
    }

    // Check if file exists
    const exists = await storageService.fileExists(filePath);

    res.json({
      ok: true,
      data: {
        exists,
        filePath,
      },
    });
  } catch (error) {
    logger.error('Failed to check file existence', {
      error: error.message,
      userId: req.user?.uid,
      filePath: req.query.filePath,
    });

    res.status(500).json({
      ok: false,
      error: 'Failed to check file existence',
      code: 'EXISTS_CHECK_ERROR',
    });
  }
}

/**
 * Get file size
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getFileSize(req, res) {
  try {
    const { filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({
        ok: false,
        error: 'File path is required',
        code: 'MISSING_FILE_PATH',
      });
    }

    // Get file size
    const size = await storageService.getFileSize(filePath);

    res.json({
      ok: true,
      data: {
        size,
        filePath,
        sizeInMB: (size / (1024 * 1024)).toFixed(2),
      },
    });
  } catch (error) {
    logger.error('Failed to get file size', {
      error: error.message,
      userId: req.user?.uid,
      filePath: req.query.filePath,
    });

    if (error.message.includes('File not found')) {
      return res.status(404).json({
        ok: false,
        error: 'File not found',
        code: 'FILE_NOT_FOUND',
      });
    }

    res.status(500).json({
      ok: false,
      error: 'Failed to get file size',
      code: 'SIZE_CHECK_ERROR',
    });
  }
}

/**
 * List files in a directory
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function listFiles(req, res) {
  try {
    const { directory, maxResults, pageToken } = req.query;

    if (!directory) {
      return res.status(400).json({
        ok: false,
        error: 'Directory path is required',
        code: 'MISSING_DIRECTORY',
      });
    }

    // List files
    const result = await storageService.listFiles(directory, {
      maxResults: maxResults ? parseInt(maxResults) : 1000,
      pageToken,
    });

    logger.info('Files listed by user', {
      userId: req.user.uid,
      directory,
      count: result.files.length,
    });

    res.json({
      ok: true,
      data: result,
      meta: {
        directory,
        totalFiles: result.files.length,
        hasNextPage: !!result.nextPageToken,
      },
    });
  } catch (error) {
    logger.error('Failed to list files', {
      error: error.message,
      userId: req.user.uid,
      directory: req.query.directory,
    });

    res.status(500).json({
      ok: false,
      error: 'Failed to list files',
      code: 'LIST_ERROR',
    });
  }
}

/**
 * Generate signed upload URL for chat media
 */
async function generateChatUploadUrlController(req, res) {
  try {
    const { conversationId, type, mime, size } = req.body;
    const userId = req.user.uid;

    // Check if user is a participant in the conversation
    const participant = await isParticipant(userId, conversationId);
    if (!participant) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'NOT_PARTICIPANT',
          message: 'You are not a participant in this conversation',
        },
      });
    }

    // Validate media
    const validation = validateChatMedia(mime, size, type);
    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_MEDIA',
          message: validation.error,
        },
      });
    }

    // Generate a temporary message ID for the upload
    const messageId = require('uuid').v4();
    
    // Get file extension from MIME type
    const extension = mime.split('/')[1] || 'bin';
    
    // Generate signed URL
    const result = await libGenerateChatUploadUrl(conversationId, messageId, mime, extension);

    res.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to generate chat upload URL', {
      error: error.message,
      userId: req.user.uid,
      body: req.body,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate upload URL',
      },
    });
  }
}

module.exports = {
  generateUploadUrl,
  generateDownloadUrl,
  deleteFile,
  getFileMetadata,
  checkFileExists,
  getFileSize,
  listFiles,
  generateChatUploadUrl: generateChatUploadUrlController,
};
