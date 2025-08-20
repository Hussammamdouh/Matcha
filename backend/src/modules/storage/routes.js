const express = require('express');
const { authenticateToken } = require('../../middlewares/auth');
const { generalRateLimiter } = require('../../middlewares/rateLimit');
const {
  generateUploadUrlValidation,
  generateDownloadUrlValidation,
  deleteFileValidation,
  getFileMetadataValidation,
  checkFileExistsValidation,
  getFileSizeValidation,
  listFilesValidation,
  validate,
} = require('./validators');
const {
  generateUploadUrl,
  generateDownloadUrl,
  deleteFile,
  getFileMetadata,
  checkFileExists,
  getFileSize,
  listFiles,
  generateChatUploadUrl,
} = require('./controller');

const router = express.Router();

// Generate signed URLs
router.post(
  '/upload-url',
  authenticateToken,
  generalRateLimiter,
  generateUploadUrlValidation,
  validate,
  generateUploadUrl
);
router.post(
  '/download-url',
  authenticateToken,
  generalRateLimiter,
  generateDownloadUrlValidation,
  validate,
  generateDownloadUrl
);

// File operations
router.delete(
  '/:filePath(*)',
  authenticateToken,
  generalRateLimiter,
  deleteFileValidation,
  validate,
  deleteFile
);
router.get(
  '/metadata/:filePath(*)',
  authenticateToken,
  getFileMetadataValidation,
  validate,
  getFileMetadata
);

// File information
router.get('/exists', authenticateToken, checkFileExistsValidation, validate, checkFileExists);
router.get('/size', authenticateToken, getFileSizeValidation, validate, getFileSize);
router.get('/list', authenticateToken, listFilesValidation, validate, listFiles);

/**
 * @swagger
 * /api/v1/storage/chat/sign:
 *   post:
 *     summary: Generate chat media upload URL
 *     description: Generate a signed URL for uploading chat media (images/audio)
 *     tags: [Storage]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               conversationId:
 *                 type: string
 *                 description: Conversation ID for the media
 *               type:
 *                 type: string
 *                 enum: [image, audio]
 *                 description: Media type
 *               mime:
 *                 type: string
 *                 description: MIME type of the file
 *               size:
 *                 type: number
 *                 description: File size in bytes
 *             required:
 *               - conversationId
 *               - type
 *               - mime
 *               - size
 *     responses:
 *       200:
 *         description: Upload URL generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       description: Signed upload URL
 *                     objectPath:
 *                       type: string
 *                       description: Storage object path
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       description: URL expiration time
 *                     headers:
 *                       type: object
 *                       description: Required headers for upload
 *       400:
 *         description: Invalid request or media validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - not a conversation participant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Rate limited
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Chat storage signing
router.post('/chat/sign', authenticateToken, generateChatUploadUrl);

module.exports = router;
