const express = require('express');
const { body, validationResult } = require('express-validator');
const { verifyFirebaseIdToken } = require('../../middlewares/firebaseAuth');
const { asyncHandler } = require('../../middlewares/error');
const userController = require('./controller');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         uid:
 *           type: string
 *           description: User's unique identifier
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         nickname:
 *           type: string
 *           description: User's unique nickname
 *         avatarUrl:
 *           type: string
 *           description: URL to user's avatar image
 *         status:
 *           type: string
 *           enum: [active, suspended, deleted]
 *           description: User account status
 *         genderVerificationStatus:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           description: KYC verification status
 *         isMfaEnabled:
 *           type: boolean
 *           description: Whether MFA is enabled
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     UpdateProfileRequest:
 *       type: object
 *       properties:
 *         nickname:
 *           type: string
 *           minLength: 3
 *           maxLength: 20
 *           description: New nickname (must be unique)
 *         avatarUrl:
 *           type: string
 *           format: uri
 *           description: New avatar URL
 */

/**
 * @swagger
 * /api/v1/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Authentication required
 */
router.get('/', verifyFirebaseIdToken, asyncHandler(userController.getProfile));

/**
 * @swagger
 * /api/v1/me:
 *   patch:
 *     summary: Update current user profile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error or nickname already taken
 *       401:
 *         description: Authentication required
 */
router.patch(
  '/',
  verifyFirebaseIdToken,
  [
    body('nickname')
      .optional()
      .isLength({ min: 3, max: 20 })
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Nickname must be 3-20 characters, alphanumeric, underscore, or dash only'),
    body('avatarUrl').optional().isURL().withMessage('Avatar URL must be a valid URL'),
  ],
  asyncHandler(userController.updateProfile)
);

/**
 * @swagger
 * /api/v1/me/email/verify/send:
 *   post:
 *     summary: Send email verification
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent successfully
 *       401:
 *         description: Authentication required
 */
router.post(
  '/email/verify/send',
  verifyFirebaseIdToken,
  asyncHandler(userController.sendEmailVerification)
);

/**
 * @swagger
 * /api/v1/me/logout:
 *   post:
 *     summary: Logout current user (revoke refresh tokens)
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Authentication required
 */
router.post('/logout', verifyFirebaseIdToken, asyncHandler(userController.logout));

/**
 * @swagger
 * /api/v1/me/logout-all:
 *   post:
 *     summary: Logout from all devices (revoke all refresh tokens)
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout from all devices successful
 *       401:
 *         description: Authentication required
 */
router.post('/logout-all', verifyFirebaseIdToken, asyncHandler(userController.logoutAll));

/**
 * @swagger
 * /api/v1/me:
 *   delete:
 *     summary: Delete current user account
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deletion initiated
 *       401:
 *         description: Authentication required
 */
router.delete('/', verifyFirebaseIdToken, asyncHandler(userController.deleteAccount));

/**
 * @swagger
 * /api/v1/me/avatar/upload-url:
 *   post:
 *     summary: Generate avatar upload URL
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileName
 *               - contentType
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: File name with extension
 *               contentType:
 *                 type: string
 *                 description: MIME type of the file
 *     responses:
 *       200:
 *         description: Upload URL generated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
router.post(
  '/avatar/upload-url',
  verifyFirebaseIdToken,
  [
    body('fileName').isString().notEmpty().withMessage('File name is required'),
    body('contentType').isString().notEmpty().withMessage('Content type is required'),
  ],
  asyncHandler(userController.generateAvatarUploadUrl)
);

/**
 * @swagger
 * /api/v1/me/avatar/confirm:
 *   post:
 *     summary: Confirm avatar upload and update profile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - filePath
 *             properties:
 *               filePath:
 *                 type: string
 *                 description: File path returned from upload URL generation
 *     responses:
 *       200:
 *         description: Avatar updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
router.post(
  '/avatar/confirm',
  verifyFirebaseIdToken,
  [body('filePath').isString().notEmpty().withMessage('File path is required')],
  asyncHandler(userController.confirmAvatarUpload)
);

module.exports = router;
