/**
 * Test setup and configuration
 * This file runs before all tests
 */

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '8081';
process.env.FIREBASE_PROJECT_ID = 'matcha-test';
process.env.GOOGLE_APPLICATION_CREDENTIALS = './test-service-account-key.json';
process.env.ALLOW_ORIGINS = 'http://localhost:3000';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.LOG_REDACT_KEYS = 'authorization,password,idToken,refreshToken';

// Mock Firebase Admin SDK
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  cert: jest.fn(),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
    createUser: jest.fn(),
    getUserByEmail: jest.fn(),
    setCustomUserClaims: jest.fn(),
    generateEmailVerificationLink: jest.fn(),
    generatePasswordResetLink: jest.fn(),
    revokeRefreshTokens: jest.fn(),
  })),
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      })),
      where: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn(),
        })),
      })),
      orderBy: jest.fn(() => ({
        get: jest.fn(),
      })),
    })),
  })),
}));

jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn(() => ({
    bucket: jest.fn(() => ({
      file: jest.fn(() => ({
        getSignedUrl: jest.fn(),
        delete: jest.fn(),
      })),
    })),
  })),
}));

// Mock email service
jest.mock('../src/lib/mail', () => ({
  sendEmail: jest.fn(),
}));

// Mock audit service
jest.mock('../src/modules/audit/service', () => ({
  createAuditLog: jest.fn(),
}));

// Mock logger
jest.mock('../src/lib/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  createRequestLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  logRequest: jest.fn((req, res, next) => next()),
}));

// Global test utilities
global.testUtils = {
  // Mock user data
  mockUser: {
    uid: 'test-user-123',
    email: 'test@example.com',
    emailVerified: true,
    customClaims: {
      role: 'user',
      gv: 'approved',
    },
  },
  
  // Mock request object
  mockRequest: (overrides = {}) => ({
    id: 'test-request-123',
    ip: '127.0.0.1',
    get: jest.fn(),
    headers: {},
    body: {},
    params: {},
    query: {},
    user: global.testUtils.mockUser,
    ...overrides,
  }),
  
  // Mock response object
  mockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
  },
  
  // Mock next function
  mockNext: jest.fn(),
};

// Suppress console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Test timeout
jest.setTimeout(10000);

