const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../../middlewares/auth');
const { asyncHandler } = require('../../middlewares/error');
const { validateBody, validateQuery } = require('../../middlewares/validation');
const userController = require('./controller');
const postsController = require('../posts/controller');
const followController = require('./social.controller');
const settingsController = require('./settings.controller');
const { updateSettingsValidation, paginationValidation } = require('./settings.validators');
const blocksController = require('../chat/blocks/controller');

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
router.get('/', authenticateToken, asyncHandler(userController.getProfile));
// Public user endpoints with privacy
router.get('/:id', authenticateToken, asyncHandler(userController.getPublicProfile));
router.get('/:id/likes', authenticateToken, asyncHandler(userController.getUserLikedPosts));
router.get('/:id/followers', authenticateToken, asyncHandler(userController.getUserFollowers));
router.get('/:id/following', authenticateToken, asyncHandler(userController.getUserFollowing));
router.get('/stats', authenticateToken, asyncHandler(userController.getMyStatsAndPosts));
router.get('/likes', authenticateToken, asyncHandler(userController.getMyLikedPosts));
router.get('/saves', authenticateToken, asyncHandler(postsController.getSavedPosts));

// Follow/unfollow endpoints
router.post('/follow/:targetUid', authenticateToken, asyncHandler(followController.followUser));
router.post('/unfollow/:targetUid', authenticateToken, asyncHandler(followController.unfollowUser));
// Note: Detailed following/followers endpoints are now under /me/following and /me/followers

// Block/unblock endpoints
router.post('/block', authenticateToken, asyncHandler(blocksController.blockUser));
router.delete('/block/:blockedUserId', authenticateToken, asyncHandler(blocksController.unblockUser));

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
const directUpload = require('../../middlewares/directUpload');
router.patch(
  '/',
  authenticateToken,
  directUpload({ namespace: 'profile' }),
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
  authenticateToken,
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
router.post(
  '/logout',
  authenticateToken,
  asyncHandler(async (req, res, next) => {
    const all = !!req.body?.all;
    if (all) {
      return userController.logoutAll(req, res, next);
    }
    return userController.logout(req, res, next);
  })
);

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
// Backwards compatibility: deprecated in favor of POST /me/logout { all: true }
router.post('/logout-all', authenticateToken, asyncHandler(userController.logoutAll));

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
router.delete('/', authenticateToken, asyncHandler(userController.deleteAccount));

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
  authenticateToken,
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
  authenticateToken,
  [body('filePath').isString().notEmpty().withMessage('File path is required')],
  asyncHandler(userController.confirmAvatarUpload)
);

// User Settings Routes
/**
 * @swagger
 * /api/v1/me/settings:
 *   get:
 *     summary: Get user settings
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User settings retrieved successfully
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
 *                     accountPrivacy:
 *                       type: string
 *                       enum: [public, private]
 *                       example: public
 *                     showLikedPosts:
 *                       type: boolean
 *                       example: true
 *                     showFollowing:
 *                       type: boolean
 *                       example: true
 *                     showFollowers:
 *                       type: boolean
 *                       example: true
 *       401:
 *         description: Authentication required
 */
router.get('/settings', authenticateToken, asyncHandler(settingsController.getUserSettings));

/**
 * @swagger
 * /api/v1/me/settings:
 *   patch:
 *     summary: Update user settings
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accountPrivacy:
 *                 type: string
 *                 enum: [public, private]
 *                 description: Account privacy setting
 *               showLikedPosts:
 *                 type: boolean
 *                 description: Whether to show liked posts publicly
 *               showFollowing:
 *                 type: boolean
 *                 description: Whether to show following list publicly
 *               showFollowers:
 *                 type: boolean
 *                 description: Whether to show followers list publicly
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
router.patch(
  '/settings',
  authenticateToken,
  validateBody(updateSettingsValidation),
  asyncHandler(settingsController.updateUserSettings)
);

/**
 * @swagger
 * /api/v1/me/communities:
 *   get:
 *     summary: Get user's communities
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of communities per page
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor
 *     responses:
 *       200:
 *         description: User's communities retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  '/communities',
  authenticateToken,
  validateQuery(paginationValidation),
  asyncHandler(settingsController.getUserCommunities)
);

/**
 * @swagger
 * /api/v1/me/followers:
 *   get:
 *     summary: Get detailed followers list
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of followers per page
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor
 *     responses:
 *       200:
 *         description: Detailed followers retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  '/followers',
  authenticateToken,
  validateQuery(paginationValidation),
  asyncHandler(settingsController.getDetailedFollowers)
);

/**
 * @swagger
 * /api/v1/me/following:
 *   get:
 *     summary: Get detailed following list
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of following per page
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor
 *     responses:
 *       200:
 *         description: Detailed following retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  '/following',
  authenticateToken,
  validateQuery(paginationValidation),
  asyncHandler(settingsController.getDetailedFollowing)
);

/**
 * @swagger
 * /api/v1/me/blocked:
 *   get:
 *     summary: Get detailed blocked users list
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of blocked users per page
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor
 *     responses:
 *       200:
 *         description: Detailed blocked users retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  '/blocked',
  authenticateToken,
  validateQuery(paginationValidation),
  asyncHandler(settingsController.getDetailedBlockedUsers)
);

module.exports = router;
