/**
 * Test setup file for Matcha Backend
 * Configures test environment, mocks, and utilities
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_STORAGE_BUCKET = 'test-bucket';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Mock Firebase Admin SDK
jest.mock('../src/lib/firebase', () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      })),
      add: jest.fn(),
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn()
          }))
        }))
      })),
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn()
        }))
      })),
      limit: jest.fn(() => ({
        get: jest.fn()
      })),
      get: jest.fn()
    })),
    doc: jest.fn(() => ({
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    })),
    runTransaction: jest.fn(),
    batch: jest.fn(() => ({
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn()
    }))
  },
  storage: {
    bucket: jest.fn(() => ({
      file: jest.fn(() => ({
        save: jest.fn(),
        delete: jest.fn(),
        getSignedUrl: jest.fn(),
        exists: jest.fn()
      })),
      exists: jest.fn()
    }))
  },
  auth: {
    verifyIdToken: jest.fn(),
    getUser: jest.fn(),
    createCustomToken: jest.fn(),
    revokeRefreshTokens: jest.fn()
  }
}));

// Mock Redis client
jest.mock('ioredis', () => {
  const Redis = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
    ping: jest.fn(),
    quit: jest.fn()
  }));
  
  Redis.Cluster = jest.fn();
  return Redis;
});

// Mock logger to reduce noise during tests
jest.mock('../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }))
  },
  createRequestLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })),
  createModuleLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })),
  logRequest: jest.fn(),
  logError: jest.fn(),
  logSecurityEvent: jest.fn(),
  logPerformance: jest.fn(),
  logDatabaseOperation: jest.fn(),
  logStorageOperation: jest.fn(),
  logRateLimitEvent: jest.fn(),
  logAuthEvent: jest.fn(),
  logModerationAction: jest.fn(),
  logFeatureFlag: jest.fn(),
  redactSensitiveData: jest.fn((data) => data)
}));

// Mock rate limiting middleware
jest.mock('../src/middlewares/rateLimit', () => ({
  generalRateLimiter: jest.fn((req, res, next) => next()),
  authRateLimiter: jest.fn((req, res, next) => next()),
  postCreationLimiter: jest.fn((req, res, next) => next()),
  commentCreationLimiter: jest.fn((req, res, next) => next()),
  voteLimiter: jest.fn((req, res, next) => next()),
  chatMessageLimiter: jest.fn((req, res, next) => next()),
  menReviewLimiter: jest.fn((req, res, next) => next()),
  adminActionLimiter: jest.fn((req, res, next) => next()),
  reportCreationLimiter: jest.fn((req, res, next) => next()),
  postDailyQuota: jest.fn((req, res, next) => next()),
  commentDailyQuota: jest.fn((req, res, next) => next()),
  voteDailyQuota: jest.fn((req, res, next) => next()),
  chatDailyQuota: jest.fn((req, res, next) => next()),
  menReviewDailyQuota: jest.fn((req, res, next) => next()),
  createRateLimiter: jest.fn(() => jest.fn((req, res, next) => next())),
  createDailyQuotaLimiter: jest.fn(() => jest.fn((req, res, next) => next())),
  getRateLimitInfo: jest.fn(),
  resetRateLimit: jest.fn(),
  redisClient: null
}));

// Mock validation middleware
jest.mock('../src/middlewares/validation', () => ({
  validateBody: jest.fn(() => [jest.fn((req, res, next) => next())]),
  validateParams: jest.fn(() => [jest.fn((req, res, next) => next())]),
  validateQuery: jest.fn(() => [jest.fn((req, res, next) => next())]),
  sanitizeBody: jest.fn((req, res, next) => next()),
  sanitizeHtmlContent: jest.fn((html) => html),
  sanitizeText: jest.fn((text) => text),
  commonValidations: {
    id: jest.fn(),
    uuid: jest.fn(),
    pagination: [],
    userId: jest.fn(),
    content: jest.fn(),
    title: jest.fn(),
    description: jest.fn(),
    email: jest.fn(),
    phone: jest.fn(),
    url: jest.fn(),
    file: jest.fn(),
    coordinates: [],
    date: jest.fn(),
    boolean: jest.fn(),
    array: jest.fn(),
    object: jest.fn(),
    enum: jest.fn()
  },
  featureValidations: {
    kyc: [],
    sms: [],
    recaptcha: []
  },
  body: jest.fn(),
  param: jest.fn(),
  query: jest.fn(),
  validationResult: jest.fn(() => ({
    isEmpty: () => true,
    array: () => []
  }))
}));

// Mock idempotency middleware
jest.mock('../src/middlewares/idempotency', () => ({
  createIdempotencyMiddleware: jest.fn(() => jest.fn((req, res, next) => next())),
  adminIdempotency: jest.fn((req, res, next) => next()),
  optionalIdempotency: jest.fn((req, res, next) => next()),
  generateIdempotencyKey: jest.fn(() => 'test-key'),
  checkIdempotencyKey: jest.fn(),
  storeIdempotencyKey: jest.fn(),
  generateIdempotencyKeyEndpoint: jest.fn(),
  checkIdempotencyKeyStatus: jest.fn(),
  clearIdempotencyKey: jest.fn()
}));

// Mock RBAC middleware
jest.mock('../src/middlewares/rbac', () => ({
  ROLES: {
    USER: 'user',
    MODERATOR: 'moderator',
    ADMIN: 'admin',
    SUPER_ADMIN: 'super_admin'
  },
  requireRole: jest.fn(() => jest.fn((req, res, next) => next())),
  requirePermissions: jest.fn(() => jest.fn((req, res, next) => next())),
  requireModerator: jest.fn(() => jest.fn((req, res, next) => next())),
  requireAdmin: jest.fn(() => jest.fn((req, res, next) => next())),
  requireSuperAdmin: jest.fn(() => jest.fn((req, res, next) => next())),
  hasPermission: jest.fn(),
  hasRole: jest.fn(),
  getUserRole: jest.fn(),
  getUserBanStatus: jest.fn(),
  canModerateContent: jest.fn(),
  canManageUser: jest.fn()
}));

// Mock authentication middleware
jest.mock('../src/middlewares/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { uid: 'test-user-id', email: 'test@example.com' };
    next();
  }),
  requireRole: jest.fn(() => jest.fn((req, res, next) => next())),
  requireAuth: jest.fn((req, res, next) => next())
}));

// Mock error handling middleware
jest.mock('../src/middlewares/error', () => ({
  errorHandler: jest.fn((err, req, res, next) => {
    res.status(err.status || 500).json({
      ok: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Internal server error'
      }
    });
  }),
  notFoundHandler: jest.fn((req, res) => {
    res.status(404).json({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found'
      }
    });
  }),
  asyncHandler: jest.fn((fn) => fn)
}));

// Global test utilities
global.testUtils = {
  // Create mock request object
  createMockRequest: (overrides = {}) => ({
    id: 'test-request-id',
    method: 'GET',
    url: '/test',
    path: '/test',
    originalUrl: '/test',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'test-agent',
      ...overrides.headers
    },
    query: {},
    body: {},
    params: {},
    ip: '127.0.0.1',
    user: { uid: 'test-user-id', email: 'test@example.com' },
    ...overrides
  }),

  // Create mock response object
  createMockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    res.set = jest.fn().mockReturnValue(res);
    res.get = jest.fn();
    return res;
  },

  // Create mock Firestore document
  createMockFirestoreDoc: (data = {}) => ({
    exists: true,
    id: 'test-doc-id',
    data: () => data,
    ref: {
      path: 'test/path'
    }
  }),

  // Create mock Firestore query snapshot
  createMockQuerySnapshot: (docs = []) => ({
    empty: docs.length === 0,
    size: docs.length,
    docs: docs.map(doc => ({
      ...doc,
      exists: true
    })),
    forEach: (callback) => docs.forEach(callback)
  }),

  // Mock Firebase Auth user
  createMockFirebaseUser: (overrides = {}) => ({
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: null,
    emailVerified: true,
    disabled: false,
    metadata: {
      creationTime: new Date().toISOString(),
      lastSignInTime: new Date().toISOString()
    },
    ...overrides
  }),

  // Mock community data
  createMockCommunity: (overrides = {}) => ({
    id: 'test-community-id',
    name: 'Test Community',
    description: 'A test community',
    isPrivate: false,
    ownerId: 'test-user-id',
    modIds: ['test-user-id'],
    memberCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Mock post data
  createMockPost: (overrides = {}) => ({
    id: 'test-post-id',
    title: 'Test Post',
    content: 'This is a test post',
    authorId: 'test-user-id',
    communityId: 'test-community-id',
    upvotes: 0,
    downvotes: 0,
    commentCount: 0,
    hotScore: 0,
    trendingScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Mock comment data
  createMockComment: (overrides = {}) => ({
    id: 'test-comment-id',
    content: 'This is a test comment',
    authorId: 'test-user-id',
    postId: 'test-post-id',
    parentId: null,
    upvotes: 0,
    downvotes: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Mock chat conversation
  createMockConversation: (overrides = {}) => ({
    id: 'test-conversation-id',
    type: 'direct', // 'direct' or 'group'
    participantIds: ['test-user-id', 'other-user-id'],
    lastMessageAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Mock chat message
  createMockChatMessage: (overrides = {}) => ({
    id: 'test-message-id',
    content: 'This is a test message',
    authorId: 'test-user-id',
    conversationId: 'test-conversation-id',
    type: 'text', // 'text', 'image', 'video', 'audio'
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Mock men-review subject
  createMockMenSubject: (overrides = {}) => ({
    id: 'test-subject-id',
    creatorId: 'test-user-id',
    originalImagePath: 'men/subjects/test-subject-id/original/image.jpg',
    processedImagePath: 'men/subjects/test-subject-id/processed/image.jpg',
    status: 'pending', // 'pending', 'approved', 'rejected'
    upvotes: 0,
    downvotes: 0,
    commentCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Mock report data
  createMockReport: (overrides = {}) => ({
    id: 'test-report-id',
    surface: 'feed', // 'feed', 'chat', 'men'
    entityType: 'post', // 'post', 'comment', 'message', 'subject', 'user'
    entityId: 'test-entity-id',
    reporterId: 'test-user-id',
    reason: 'Inappropriate content',
    status: 'new', // 'new', 'in_review', 'resolved', 'dismissed'
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Mock user data
  createMockUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    nickname: 'TestUser',
    role: 'user', // 'user', 'moderator', 'admin', 'super_admin'
    isBanned: false,
    isSuspended: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Clean up mocks
  cleanupMocks: () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  }
};

// Global test setup
beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Set up default test environment
  process.env.NODE_ENV = 'test';
  process.env.FIREBASE_PROJECT_ID = 'test-project';
  process.env.FIREBASE_STORAGE_BUCKET = 'test-bucket';
  process.env.LOG_LEVEL = 'error';
});

// Global test teardown
afterEach(() => {
  // Clean up after each test
  global.testUtils.cleanupMocks();
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});



