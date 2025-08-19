const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../../middlewares/auth');
const { authRateLimiter, passwordResetRateLimiter, emailVerificationRateLimiter } = require('../../middlewares/rateLimit');
const { asyncHandler } = require('../../middlewares/error');
const authController = require('./controller');
const { loginWithEmailPassword } = require('./service');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     EmailRegistrationRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - nickname
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         password:
 *           type: string
 *           minLength: 8
 *           description: User's password (min 8 characters)
 *         nickname:
 *           type: string
 *           minLength: 3
 *           maxLength: 20
 *           description: User's unique nickname

 *     

 *     

 *     
 *     PasswordResetRequest:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *     

 *     
 *     MfaSetupRequest:
 *       type: object
 *       required:
 *         - type
 *       properties:
 *         type:
 *           type: string
 *           enum: [totp]
 *     
 *     MfaVerifyRequest:
 *       type: object
 *       required:
 *         - type
 *         - code
 *       properties:
 *         type:
 *           type: string
 *           enum: [totp]
 *         code:
 *           type: string
 */

/**
 * @swagger
 * /api/v1/auth/register-email:
 *   post:
 *     summary: Register new user with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailRegistrationRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
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
 *                     userId:
 *                       type: string
 *                     email:
 *                       type: string
 *                     nickname:
 *                       type: string
 *                     message:
 *                       type: string
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email or nickname already exists
 */
router.post('/register-email',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('nickname').isLength({ min: 3, max: 20 }).matches(/^[a-zA-Z0-9_-]+$/).withMessage('Nickname must be 3-20 characters, alphanumeric, underscore, or dash only'),
  ],
  asyncHandler(authController.registerWithEmail)
);







/**
 * @swagger
 * /api/v1/auth/oauth/google:
 *   post:
 *     summary: Authenticate with Google OAuth
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Google ID token from client
 *     responses:
 *       200:
 *         description: OAuth authentication successful
 *       401:
 *         description: Invalid Google ID token
 */
router.post('/oauth/google',
  authRateLimiter,
  [
    body('idToken').isString().notEmpty(),
  ],
  asyncHandler(authController.authenticateWithGoogle)
);

/**
 * @swagger
 * /api/v1/auth/oauth/apple:
 *   post:
 *     summary: Authenticate with Apple OAuth
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Apple ID token from client
 *     responses:
 *       200:
 *         description: OAuth authentication successful
 *       401:
 *         description: Invalid Apple ID token
 */
router.post('/oauth/apple',
  authRateLimiter,
  [
    body('idToken').isString().notEmpty(),
  ],
  asyncHandler(authController.authenticateWithApple)
);

/**
 * @swagger
 * /api/v1/auth/password/forgot:
 *   post:
 *     summary: Request password reset via Firebase
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PasswordResetRequest'
 *     responses:
 *       200:
 *         description: Password reset email sent via Firebase
 *       400:
 *         description: Invalid email
 */
router.post('/password/forgot',
  passwordResetRateLimiter,
  [
    body('email').isEmail().normalizeEmail(),
  ],
  asyncHandler(authController.forgotPassword)
);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login with email and password (Firebase Identity Toolkit)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, returns ID token
 *       400:
 *         description: Invalid credentials
 */
router.post('/login',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 8 }),
  ],
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await loginWithEmailPassword(email, password);
    res.status(200).json({ ok: true, data: result, error: null, meta: { requestId: req.id } });
  })
);



/**
 * @swagger
 * /api/v1/auth/mfa/setup:
 *   post:
 *     summary: Setup MFA for user account
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MfaSetupRequest'
 *     responses:
 *       200:
 *         description: MFA setup initiated
 *       401:
 *         description: Authentication required
 */
router.post('/mfa/setup',
  authenticateToken,
  [
    body('type').isIn(['totp']),
  ],
  asyncHandler(authController.setupMfa)
);

/**
 * @swagger
 * /api/v1/auth/mfa/verify:
 *   post:
 *     summary: Verify MFA code
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MfaVerifyRequest'
 *     responses:
 *       200:
 *         description: MFA verification successful
 *       400:
 *         description: Invalid MFA code
 *       401:
 *         description: Authentication required
 */
router.post('/mfa/verify',
  authenticateToken,
  [
    body('type').isIn(['totp']),
    body('code').isString().notEmpty(),
  ],
  asyncHandler(authController.verifyMfa)
);

/**
 * @swagger
 * /api/v1/auth/mfa/disable:
 *   delete:
 *     summary: Disable MFA for user account
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: MFA disabled successfully
 *       401:
 *         description: Authentication required
 */
router.delete('/mfa/disable',
  authenticateToken,
  asyncHandler(authController.disableMfa)
);



module.exports = router;
