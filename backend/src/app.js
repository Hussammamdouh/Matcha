const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const { config, validateConfig, features } = require('./config');
const { initializeFirebase } = require('./lib/firebase');
const { createRequestLogger } = require('./lib/logger');
const { logRequest } = require('./lib/logger');
const requestIdMiddleware = require('./middlewares/requestId');
const { errorHandler, notFoundHandler } = require('./middlewares/error');
const { generalRateLimiter } = require('./middlewares/rateLimit');

// Import route modules
const authRoutes = require('./modules/auth/routes');
const userRoutes = require('./modules/users/routes');
const deviceRoutes = require('./modules/devices/routes');
const sessionRoutes = require('./modules/sessions/routes');

const adminRoutes = require('./modules/admin/routes');
const auditRoutes = require('./modules/audit/routes');
const webhookRoutes = require('./webhooks/routes');
const jobRoutes = require('./jobs/routes');

// Feed-related route modules will be imported after Firebase initialization

// Import health check routes
const healthRoutes = require('./routes/health');

// Import OpenAPI documentation
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');

const logger = createRequestLogger();

/**
 * Create and configure Express application
 */
function createApp() {
  const app = express();

  // Initialize Firebase Admin SDK
  try {
    initializeFirebase();
    logger.info('Firebase Admin SDK initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }

  // Trust proxy for accurate IP addresses behind load balancers
  app.set('trust proxy', true);

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noCache: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: config.cors.origins,
      credentials: config.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-ID',
        'X-Device-ID',
        'X-Client-Version',
      ],
      exposedHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining'],
    })
  );

  // Request parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Security middleware
  app.use(hpp()); // Protect against HTTP Parameter Pollution

  // Request ID middleware (must be early for logging)
  app.use(requestIdMiddleware);

  // Request logging middleware
  app.use(logRequest);

  // Rate limiting middleware
  app.use(generalRateLimiter);

  // Health check endpoints (no authentication required)
  app.use('/healthz', healthRoutes);
  app.use('/readyz', healthRoutes);

  // API documentation (basic auth in production)
  if (config.isDevelopment) {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    logger.info('Swagger UI available at /docs');
  } else {
    // TODO: Add basic auth for production documentation
    app.use('/docs', (req, res) => {
      res.status(401).json({
        ok: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Documentation access requires authentication in production',
        },
      });
    });
  }

  // API routes with versioning
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/me', userRoutes);
  app.use('/api/v1/me/devices', deviceRoutes);
  app.use('/api/v1/me/sessions', sessionRoutes);

  // Feed-related routes (imported after Firebase initialization)
  const communityRoutes = require('./modules/communities/routes');
  const postRoutes = require('./modules/posts/routes');
  const commentRoutes = require('./modules/comments/routes');
  const reportRoutes = require('./modules/reports/routes');
  const searchRoutes = require('./modules/search/routes');
  const storageRoutes = require('./modules/storage/routes');

  // Chat routes (imported after Firebase initialization)
  const chatRoutes = require('./modules/chat/routes');

  app.use('/api/v1/communities', communityRoutes);
  app.use('/api/v1/posts', postRoutes);
  app.use('/api/v1/comments', commentRoutes);
  app.use('/api/v1/reports', reportRoutes);
  app.use('/api/v1/search', searchRoutes);
  app.use('/api/v1/storage', storageRoutes);
  app.use('/api/v1/chat', chatRoutes);

  // Feed-specific routes
  app.use(
    '/api/v1/feed/home',
    (req, res, next) => {
      // Route to posts controller for home feed
      req.url = '/';
      next();
    },
    require('./modules/posts/controller').getHomeFeed
  );

  app.use(
    '/api/v1/feed/saved',
    (req, res, next) => {
      // Route to posts controller for saved posts
      req.url = '/';
      next();
    },
    require('./modules/posts/controller').getSavedPosts
  );

  // KYC and admin routes (feature-flagged)
  if (features.kyc) {
    app.use('/api/v1/admin', adminRoutes);
    app.use('/api/v1/webhooks', webhookRoutes);
  }

  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/jobs', jobRoutes);

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Start the Express server
 */
function startServer() {
  try {
    // Validate configuration
    validateConfig();

    const app = createApp();
    const server = app.listen(config.port, () => {
      logger.info('Matcha backend server started successfully', {
        port: config.port,
        environment: config.env,
        nodeVersion: process.version,
        firebaseProject: config.firebase.projectId,
      });
    });

    // Graceful shutdown handling
    const gracefulShutdown = signal => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', error => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise: promise.toString(),
      });
      process.exit(1);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Export for testing
module.exports = {
  createApp,
  startServer,
};

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}
