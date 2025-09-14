const express = require('express');
const { body } = require('express-validator');
const { verifyFirebaseIdToken } = require('../../middlewares/firebaseAuth');
const { asyncHandler } = require('../../middlewares/error');
const deviceController = require('./controller');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     DeviceRegistrationRequest:
 *       type: object
 *       required:
 *         - platform
 *         - pushToken
 *       properties:
 *         platform:
 *           type: string
 *           enum: [ios, android, web]
 *           description: Device platform
 *         pushToken:
 *           type: string
 *           description: Push notification token
 *         deviceId:
 *           type: string
 *           description: Unique device identifier
 *         deviceName:
 *           type: string
 *           description: Human-readable device name
 *         appVersion:
 *           type: string
 *           description: App version
 *         osVersion:
 *           type: string
 *           description: Operating system version
 *
 *     Device:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Device ID
 *         platform:
 *           type: string
 *           enum: [ios, android, web]
 *         pushToken:
 *           type: string
 *         deviceName:
 *           type: string
 *         appVersion:
 *           type: string
 *         osVersion:
 *           type: string
 *         lastSeen:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/me/devices/register:
 *   post:
 *     summary: Register a new device
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeviceRegistrationRequest'
 *     responses:
 *       201:
 *         description: Device registered successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
router.post(
  '/register',
  verifyFirebaseIdToken,
  [
    body('platform')
      .isIn(['ios', 'android', 'web'])
      .withMessage('Platform must be ios, android, or web'),
    body('pushToken').isString().notEmpty().withMessage('Push token is required'),
    body('deviceId').optional().isString(),
    body('deviceName').optional().isString(),
    body('appVersion').optional().isString(),
    body('osVersion').optional().isString(),
  ],
  asyncHandler(deviceController.registerDevice)
);

/**
 * @swagger
 * /api/v1/me/devices:
 *   get:
 *     summary: List user's devices
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of devices retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Device'
 *       401:
 *         description: Authentication required
 */
router.get('/', verifyFirebaseIdToken, asyncHandler(deviceController.listDevices));

/**
 * @swagger
 * /api/v1/me/devices/{deviceId}:
 *   delete:
 *     summary: Revoke a device
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Device ID to revoke
 *     responses:
 *       200:
 *         description: Device revoked successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Device not found
 */
router.delete('/:deviceId', verifyFirebaseIdToken, asyncHandler(deviceController.revokeDevice));

// Unified device management endpoint
// POST /api/v1/me/devices/manage { action: 'register'|'list'|'revoke', deviceId?: '...', ...deviceData }
router.post(
  '/manage',
  verifyFirebaseIdToken,
  async (req, res) => {
    try {
      const { action, deviceId, ...deviceData } = req.body;
      const userId = req.user.uid;

      if (!action) {
        return res.status(400).json({
          ok: false,
          error: { code: 'MISSING_ACTION', message: 'Action is required' }
        });
      }

      const validActions = ['register', 'list', 'revoke'];
      if (!validActions.includes(action)) {
        return res.status(400).json({
          ok: false,
          error: { 
            code: 'INVALID_ACTION', 
            message: `Action must be one of: ${validActions.join(', ')}` 
          }
        });
      }

      // Route to appropriate controller based on action
      switch (action) {
        case 'register':
          req.body = deviceData;
          return deviceController.registerDevice(req, res);
        case 'list':
          return deviceController.listDevices(req, res);
        case 'revoke':
          if (!deviceId) {
            return res.status(400).json({
              ok: false,
              error: { code: 'MISSING_DEVICE_ID', message: 'deviceId is required for revoke action' }
            });
          }
          req.params = { deviceId };
          return deviceController.revokeDevice(req, res);
        default:
          return res.status(400).json({
            ok: false,
            error: { code: 'INVALID_ACTION', message: 'Unknown action' }
          });
      }
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: { code: 'DEVICE_MANAGEMENT_FAILED', message: 'Failed to manage device' }
      });
    }
  }
);

module.exports = router;
