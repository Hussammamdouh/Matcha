const { getFirestore } = require('../../../lib/firebase');
const { createRequestLogger } = require('../../lib/logger');
const { createAuditLog } = require('../audit/service');
const { v4: uuidv4 } = require('uuid');

/**
 * Register a new device for the user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function registerDevice(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;
  const { platform, pushToken, deviceId, deviceName, appVersion, osVersion } = req.body;

  try {
    const firestore = getFirestore();

    // Generate device ID if not provided
    const finalDeviceId = deviceId || uuidv4();

    // Check if device already exists for this user
    const existingDevice = await firestore
      .collection('devices')
      .where('userId', '==', uid)
      .where('deviceId', '==', finalDeviceId)
      .limit(1)
      .get();

    if (!existingDevice.empty) {
      // Update existing device
      const deviceDoc = existingDevice.docs[0];
      await deviceDoc.ref.update({
        platform,
        pushToken,
        deviceName: deviceName || deviceDoc.data().deviceName,
        appVersion: appVersion || deviceDoc.data().appVersion,
        osVersion: osVersion || deviceDoc.data().osVersion,
        lastSeen: new Date(),
        updatedAt: new Date(),
      });

      logger.info('Device updated successfully', {
        userId: uid,
        deviceId: finalDeviceId,
        platform,
      });

      return res.status(200).json({
        ok: true,
        data: {
          message: 'Device updated successfully',
          deviceId: finalDeviceId,
        },
        error: null,
        meta: {
          requestId: req.id,
        },
      });
    }

    // Create new device
    const deviceData = {
      id: uuidv4(),
      userId: uid,
      deviceId: finalDeviceId,
      platform,
      pushToken,
      deviceName: deviceName || `${platform} device`,
      appVersion: appVersion || '1.0.0',
      osVersion: osVersion || 'unknown',
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await firestore.collection('devices').doc(deviceData.id).set(deviceData);

    // Create audit log
    await createAuditLog({
      actorUserId: uid,
      action: 'device_registered',
      entity: 'device',
      entityId: deviceData.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        platform,
        deviceId: finalDeviceId,
        deviceName: deviceData.deviceName,
      },
    });

    logger.info('Device registered successfully', {
      userId: uid,
      deviceId: finalDeviceId,
      platform,
    });

    res.status(201).json({
      ok: true,
      data: {
        message: 'Device registered successfully',
        device: deviceData,
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Device registration failed', {
      error: error.message,
      stack: error.stack,
      userId: uid,
      platform,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'DEVICE_REGISTRATION_FAILED',
        message: 'Failed to register device',
      },
      meta: {
        requestId: req.id,
      },
    });
  }
}

/**
 * List user's devices
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function listDevices(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;

  try {
    const firestore = getFirestore();
    const { pageSize = 20, cursor = null } = req.query;

    let query = firestore
      .collection('devices')
      .where('userId', '==', uid)
      .orderBy('lastSeen', 'desc');

    if (cursor) {
      try {
        const cursorDoc = await firestore.collection('devices').doc(cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      } catch (_) {}
    }

    const devicesSnapshot = await query.limit(parseInt(pageSize)).get();

    const devices = devicesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.id,
        platform: data.platform,
        pushToken: data.pushToken,
        deviceName: data.deviceName,
        appVersion: data.appVersion,
        osVersion: data.osVersion,
        lastSeen: data.lastSeen.toDate().toISOString(),
        createdAt: data.createdAt.toDate().toISOString(),
      };
    });

    logger.info('Devices retrieved successfully', {
      userId: uid,
      count: devices.length,
    });

    res.status(200).json({
      ok: true,
      data: devices,
      meta: {
        pagination: {
          pageSize: parseInt(pageSize),
          hasMore: devices.length === parseInt(pageSize),
          nextCursor: devicesSnapshot.docs.length === parseInt(pageSize)
            ? devicesSnapshot.docs[devicesSnapshot.docs.length - 1].id
            : null,
        },
      },
      error: null,
      requestId: req.id,
    });
  } catch (error) {
    logger.error('Failed to retrieve devices', {
      error: error.message,
      stack: error.stack,
      userId: uid,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'DEVICE_RETRIEVAL_FAILED',
        message: 'Failed to retrieve devices',
      },
      meta: {
        requestId: req.id,
      },
    });
  }
}

/**
 * Revoke a device
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function revokeDevice(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;
  const { deviceId } = req.params;

  try {
    const firestore = getFirestore();

    // Find the device
    const deviceSnapshot = await firestore
      .collection('devices')
      .where('userId', '==', uid)
      .where('id', '==', deviceId)
      .limit(1)
      .get();

    if (deviceSnapshot.empty) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'DEVICE_NOT_FOUND',
          message: 'Device not found',
        },
        meta: {
          requestId: req.id,
        },
      });
    }

    const deviceDoc = deviceSnapshot.docs[0];
    const deviceData = deviceDoc.data();

    // Delete the device
    await deviceDoc.ref.delete();

    // Create audit log
    await createAuditLog({
      actorUserId: uid,
      action: 'device_revoked',
      entity: 'device',
      entityId: deviceId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        platform: deviceData.platform,
        deviceId: deviceData.deviceId,
        deviceName: deviceData.deviceName,
      },
    });

    logger.info('Device revoked successfully', {
      userId: uid,
      deviceId,
      platform: deviceData.platform,
    });

    res.status(200).json({
      ok: true,
      data: {
        message: 'Device revoked successfully',
        deviceId,
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Device revocation failed', {
      error: error.message,
      stack: error.stack,
      userId: uid,
      deviceId,
    });

    res.status(500).json({
      ok: false,
      error: {
        code: 'DEVICE_REVOCATION_FAILED',
        message: 'Failed to revoke device',
      },
      meta: {
        requestId: req.id,
      },
    });
  }
}

module.exports = {
  registerDevice,
  listDevices,
  revokeDevice,
};




