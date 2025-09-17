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

// Proxy direct-upload endpoint for Cloudinary form POST if clients cannot POST to Cloudinary
router.post('/proxy/upload', authenticateToken, async (req, res) => {
  try {
    if ((process.env.STORAGE_PROVIDER || 'firebase').toLowerCase() !== 'cloudinary') {
      return res.status(400).json({ ok: false, error: 'Proxy only available for Cloudinary', code: 'PROXY_UNSUPPORTED' });
    }
    const busboy = require('busboy');
    const form = busboy({ headers: req.headers });
    const cloudinary = require('cloudinary').v2;
    if (!cloudinary.config().cloud_name) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    }

    const fields = {};
    let fileHandled = false;

    form.on('field', (name, val) => { fields[name] = val; });
    form.on('file', (name, file, info) => {
      fileHandled = true;
      const resourceType = (fields.resource_type || 'auto');
      const options = { resource_type: resourceType, public_id: fields.public_id, overwrite: true, folder: undefined };
      const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) {
          return res.status(500).json({ ok: false, error: error.message, code: 'PROXY_UPLOAD_FAILED' });
        }
        return res.json({ ok: true, data: { publicId: result.public_id, url: result.secure_url, resourceType: result.resource_type } });
      });
      file.pipe(uploadStream);
    });
    form.on('close', () => {
      if (!fileHandled) {
        return res.status(400).json({ ok: false, error: 'No file provided', code: 'NO_FILE' });
      }
    });
    req.pipe(form);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Proxy upload failed', code: 'PROXY_ERROR' });
  }
});

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

// Unified signing endpoint: supports generic upload/download and chat media via "mode"
// POST /api/v1/storage/sign { mode: 'upload'|'download'|'chat', ... }
router.post('/sign', authenticateToken, async (req, res) => {
  try {
    const mode = req.body?.mode || 'upload';
    if (mode === 'upload') {
      return generateUploadUrl(req, res);
    }
    if (mode === 'download') {
      return generateDownloadUrl(req, res);
    }
    if (mode === 'chat') {
      return generateChatUploadUrl(req, res);
    }
    return res.status(400).json({ ok: false, error: 'Invalid mode', code: 'INVALID_MODE' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Signing failed', code: 'SIGN_ERROR' });
  }
});

module.exports = router;
