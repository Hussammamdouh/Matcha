const express = require('express');
const { db, storage } = require('../lib/firebase');
const { redisClient } = require('../middlewares/rateLimit');
const { config } = require('../config');
const logger = require('../lib/logger');

const router = express.Router();

/**
 * Health check endpoint - basic server health
 * Always returns 200 if server is running
 */
router.get('/healthz', async (req, res) => {
  try {
    // Basic health check - server is running
    const healthStatus = {
      ok: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env,
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      }
    };

    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({
      ok: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Readiness check endpoint - checks external dependencies
 * Returns 200 only if all critical services are available
 */
router.get('/readyz', async (req, res) => {
  const startTime = Date.now();
  const checks = {
    firestore: false,
    storage: false,
    redis: false
  };

  try {
    // Check Firestore connectivity
    try {
      const firestoreStart = Date.now();
      await db.collection('_health').doc('ping').get();
      checks.firestore = true;
      logger.debug('Firestore health check passed', { 
        duration: Date.now() - firestoreStart 
      });
    } catch (error) {
      logger.error('Firestore health check failed', { error: error.message });
      checks.firestore = false;
    }

    // Check Storage connectivity
    try {
      const storageStart = Date.now();
      const bucket = storage.bucket(config.firebase.storageBucket);
      await bucket.exists();
      checks.storage = true;
      logger.debug('Storage health check passed', { 
        duration: Date.now() - storageStart 
      });
    } catch (error) {
      logger.error('Storage health check failed', { error: error.message });
      checks.storage = false;
    }

    // Check Redis connectivity (if enabled)
    if (config.redis?.enabled && redisClient) {
      try {
        const redisStart = Date.now();
        await redisClient.ping();
        checks.redis = true;
        logger.debug('Redis health check passed', { 
          duration: Date.now() - redisStart 
        });
      } catch (error) {
        logger.error('Redis health check failed', { error: error.message });
        checks.redis = false;
      }
    } else {
      // Redis not configured, mark as healthy
      checks.redis = true;
    }

    const totalDuration = Date.now() - startTime;
    const allHealthy = Object.values(checks).every(check => check === true);

    const readinessStatus = {
      ok: allHealthy,
      timestamp: new Date().toISOString(),
      duration: `${totalDuration}ms`,
      checks: {
        firestore: {
          status: checks.firestore ? 'healthy' : 'unhealthy',
          required: true
        },
        storage: {
          status: checks.storage ? 'healthy' : 'unhealthy',
          required: true
        },
        redis: {
          status: checks.redis ? 'healthy' : 'unhealthy',
          required: config.redis?.enabled || false
        }
      },
      environment: config.env,
      version: process.env.npm_package_version || '1.0.0'
    };

    if (allHealthy) {
      res.status(200).json(readinessStatus);
    } else {
      res.status(503).json(readinessStatus);
    }

  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(500).json({
      ok: false,
      error: 'Readiness check failed',
      timestamp: new Date().toISOString(),
      checks
    });
  }
});

/**
 * Detailed health check endpoint - comprehensive system status
 * Returns detailed information about all services
 */
router.get('/healthz/detailed', async (req, res) => {
  const startTime = Date.now();
  const detailedChecks = {};

  try {
    // Firestore detailed check
    try {
      const firestoreStart = Date.now();
      const firestoreDoc = await db.collection('_health').doc('ping').get();
      const firestoreDuration = Date.now() - firestoreStart;
      
      detailedChecks.firestore = {
        status: 'healthy',
        duration: `${firestoreDuration}ms`,
        latency: firestoreDuration,
        exists: firestoreDoc.exists,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      detailedChecks.firestore = {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }

    // Storage detailed check
    try {
      const storageStart = Date.now();
      const bucket = storage.bucket(config.firebase.storageBucket);
      const [exists] = await bucket.exists();
      const storageDuration = Date.now() - storageStart;
      
      detailedChecks.storage = {
        status: 'healthy',
        duration: `${storageDuration}ms`,
        latency: storageDuration,
        bucketExists: exists,
        bucketName: config.firebase.storageBucket,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      detailedChecks.storage = {
        status: 'unhealthy',
        error: error.message,
        bucketName: config.firebase.storageBucket,
        timestamp: new Date().toISOString()
      };
    }

    // Redis detailed check
    if (config.redis?.enabled && redisClient) {
      try {
        const redisStart = Date.now();
        const pong = await redisClient.ping();
        const redisDuration = Date.now() - redisStart;
        
        detailedChecks.redis = {
          status: 'healthy',
          duration: `${redisDuration}ms`,
          latency: redisDuration,
          response: pong,
          url: config.redis.url.replace(/\/\/.*@/, '//***@'), // Hide credentials
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        detailedChecks.redis = {
          status: 'unhealthy',
          error: error.message,
          url: config.redis.url.replace(/\/\/.*@/, '//***@'),
          timestamp: new Date().toISOString()
        };
      }
    } else {
      detailedChecks.redis = {
        status: 'not_configured',
        message: 'Redis not enabled in configuration',
        timestamp: new Date().toISOString()
      };
    }

    // System metrics
    const systemMetrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid
    };

    const totalDuration = Date.now() - startTime;
    const allHealthy = Object.values(detailedChecks).every(check => 
      check.status === 'healthy' || check.status === 'not_configured'
    );

    const detailedStatus = {
      ok: allHealthy,
      timestamp: new Date().toISOString(),
      duration: `${totalDuration}ms`,
      checks: detailedChecks,
      system: systemMetrics,
      environment: config.env,
      version: process.env.npm_package_version || '1.0.0',
      features: {
        kyc: config.features?.kyc || false,
        sms: config.features?.sms || false,
        recaptcha: config.features?.recaptcha || false
      }
    };

    if (allHealthy) {
      res.status(200).json(detailedStatus);
    } else {
      res.status(503).json(detailedStatus);
    }

  } catch (error) {
    logger.error('Detailed health check failed', { error: error.message });
    res.status(500).json({
      ok: false,
      error: 'Detailed health check failed',
      timestamp: new Date().toISOString(),
      checks: detailedChecks
    });
  }
});

/**
 * Metrics endpoint for monitoring systems
 * Returns Prometheus-style metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      // Application metrics
      app_uptime_seconds: process.uptime(),
      app_memory_bytes: process.memoryUsage().heapUsed,
      app_memory_total_bytes: process.memoryUsage().heapTotal,
      
      // Environment info
      app_environment: config.env === 'production' ? 1 : 0,
      app_version: process.env.npm_package_version || '1.0.0',
      
      // Timestamp
      app_timestamp: Date.now()
    };

    // Convert to Prometheus format
    const prometheusMetrics = Object.entries(metrics)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `# HELP ${key} ${key.replace(/_/g, ' ')}`;
        }
        return `${key} ${value}`;
      })
      .join('\n');

    res.set('Content-Type', 'text/plain');
    res.status(200).send(prometheusMetrics);

  } catch (error) {
    logger.error('Metrics endpoint failed', { error: error.message });
    res.status(500).send('# Error generating metrics\n');
  }
});

module.exports = router;
