const express = require('express');
const { getFirestore, getAuth } = require('../lib/firebase');
const { createRequestLogger } = require('../lib/logger');
const { asyncHandler } = require('../middlewares/error');

const router = express.Router();

/**
 * Basic health check endpoint
 * Used by load balancers and monitoring systems
 */
router.get('/', asyncHandler(async (req, res) => {
  const logger = createRequestLogger(req.id);
  
  logger.debug('Health check requested', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(200).json({
    ok: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    },
    error: null,
    meta: {
      requestId: req.id,
    },
  });
}));

/**
 * Readiness check endpoint
 * Checks if the service is ready to handle requests
 */
router.get('/ready', asyncHandler(async (req, res) => {
  const logger = createRequestLogger(req.id);
  
  try {
    // Check Firebase connectivity
    const firestore = getFirestore();
    const auth = getAuth();
    
    // Simple connectivity test - try to access Firestore
    await firestore.collection('_health_check').doc('test').get();
    
    logger.debug('Readiness check passed', {
      firebase: 'connected',
      firestore: 'connected',
      auth: 'connected',
    });

    res.status(200).json({
      ok: true,
      data: {
        status: 'ready',
        timestamp: new Date().toISOString(),
        services: {
          firebase: 'connected',
          firestore: 'connected',
          auth: 'connected',
        },
      },
      error: null,
      meta: {
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Readiness check failed', {
      error: error.message,
      stack: error.stack,
    });

    res.status(503).json({
      ok: false,
      data: null,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service is not ready',
        details: error.message,
      },
      meta: {
        requestId: req.id,
        timestamp: new Date().toISOString(),
      },
    });
  }
}));

/**
 * Liveness check endpoint
 * Checks if the service is alive and running
 */
router.get('/live', asyncHandler(async (req, res) => {
  const logger = createRequestLogger(req.id);
  
  logger.debug('Liveness check requested');

  res.status(200).json({
    ok: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
      pid: process.pid,
    },
    error: null,
    meta: {
      requestId: req.id,
    },
  });
}));

/**
 * Detailed health check endpoint
 * Provides comprehensive health information
 */
router.get('/detailed', asyncHandler(async (req, res) => {
  const logger = createRequestLogger(req.id);
  
  try {
    const startTime = Date.now();
    
    // Check Firebase connectivity
    const firestore = getFirestore();
    const auth = getAuth();
    
    // Test Firestore write/read
    const testDoc = firestore.collection('_health_check').doc('detailed');
    await testDoc.set({ timestamp: new Date(), test: true });
    const readResult = await testDoc.get();
    await testDoc.delete(); // Clean up test document
    
    const firebaseLatency = Date.now() - startTime;
    
    logger.debug('Detailed health check completed', {
      firebaseLatency: `${firebaseLatency}ms`,
      firestore: 'operational',
      auth: 'operational',
    });

    res.status(200).json({
      ok: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        services: {
          firebase: {
            status: 'operational',
            latency: `${firebaseLatency}ms`,
            firestore: 'operational',
            auth: 'operational',
          },
        },
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            external: Math.round(process.memoryUsage().external / 1024 / 1024),
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          },
          cpu: {
            user: process.cpuUsage().user,
            system: process.cpuUsage().system,
          },
        },
      },
      error: null,
      meta: {
        requestId: req.id,
        responseTime: `${Date.now() - startTime}ms`,
      },
    });
  } catch (error) {
    logger.error('Detailed health check failed', {
      error: error.message,
      stack: error.stack,
    });

    res.status(503).json({
      ok: false,
      data: null,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed',
        details: error.message,
      },
      meta: {
        requestId: req.id,
        timestamp: new Date().toISOString(),
      },
    });
  }
}));

module.exports = router;
