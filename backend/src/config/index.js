const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const features = require('./features');

// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Support GOOGLE_APPLICATION_CREDENTIALS_JSON (base64-encoded service account)
// This is useful on platforms like Fly.io where secrets are provided via env vars
try {
  const hasPath = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasJsonB64 = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!hasPath && hasJsonB64) {
    const decoded = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, 'base64').toString('utf8');
    const targetDir = path.resolve('/tmp');
    const targetPath = path.join(targetDir, 'service-account.json');
    fs.writeFileSync(targetPath, decoded, { encoding: 'utf8' });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = targetPath;
  }
} catch (_) {
  // If this fails, validation below will catch missing credentials
}

/**
 * Configuration object for the Matcha backend
 * In production, sensitive values should be loaded from Google Secret Manager
 */
const config = {
  // Server configuration
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 8080,
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',

  // Firebase configuration
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    webApiKey: process.env.FIREBASE_WEB_API_KEY,
  },

  // CORS configuration
  cors: {
    origins: process.env.ALLOW_ORIGINS ? process.env.ALLOW_ORIGINS.split(',') : ['http://localhost:3000'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  // Cloud KMS configuration
  kms: {
    keyName: process.env.KMS_KEY_NAME,
    enabled: !!process.env.KMS_KEY_NAME,
  },

  // Email configuration
  email: {
    provider: process.env.MAIL_PROVIDER || 'sendgrid',
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@matcha.app',
    },
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
      secure: process.env.SMTP_SECURE === 'true' || false, // true for 465, false for others
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      fromEmail: process.env.SMTP_FROM || 'noreply@matcha.app',
    },
  },



  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10) || 5,
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },

  // Cloud Tasks configuration
  cloudTasks: {
    location: process.env.CLOUD_TASKS_LOCATION || 'us-central1',
    queue: process.env.CLOUD_TASKS_QUEUE || 'default',
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    target: process.env.LOG_TARGET || 'console', // console | file | gcp
    filePath: process.env.LOG_FILE_PATH || './logs/app.log',
  },

  // Testing configuration
  test: {
    firebaseProjectId: process.env.TEST_FIREBASE_PROJECT_ID,
    credentialsPath: process.env.TEST_GOOGLE_APPLICATION_CREDENTIALS,
  },
};

/**
 * Validate required configuration values
 */
function validateConfig() {
  const required = [
    'firebase.projectId',
    'firebase.credentialsPath',
  ];

  const missing = required.filter(key => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], config);
    return !value;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }



  // Validate KMS configuration if enabled
  if (config.kms.enabled && !config.kms.keyName) {
    throw new Error('KMS key name is required when KMS is enabled');
  }
}

/**
 * Get configuration value by dot notation path
 * @param {string} path - Configuration path (e.g., 'firebase.projectId')
 * @returns {any} Configuration value
 */
function get(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], config);
}

/**
 * Check if a feature is enabled
 * @param {string} feature - Feature name (e.g., 'kms')
 * @returns {boolean} Whether the feature is enabled
 */
function isEnabled(feature) {
  return config[feature]?.enabled || false;
}

module.exports = {
  config,
  validateConfig,
  get,
  isEnabled,
  features,
};
