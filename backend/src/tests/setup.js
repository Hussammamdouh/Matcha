// Test setup file for Jest
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress console.log in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock environment variables for testing
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.GOOGLE_APPLICATION_CREDENTIALS = 'test-credentials.json';
process.env.FRONTEND_URL = 'http://localhost:3000';

// Enable all chat features for testing
process.env.ENABLE_CHAT_AUDIO = 'true';
process.env.ENABLE_CHAT_REALTIME_WS = 'true';
process.env.ENABLE_CHAT_TYPING = 'true';
process.env.ENABLE_CHAT_PRESENCE = 'true';
process.env.ENABLE_CHAT_MODERATION = 'true';
process.env.ENABLE_CHAT_PUSH = 'false';

// Global test utilities
global.createMockUser = (overrides = {}) => ({
  uid: 'user123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/avatar.jpg',
  ...overrides,
});

global.createMockConversation = (overrides = {}) => ({
  id: 'conv123',
  type: 'direct',
  members: ['user123', 'user456'],
  memberCount: 2,
  lastMessageAt: new Date(),
  lastMessagePreview: 'Hello there',
  createdAt: new Date(),
  updatedAt: new Date(),
  isLocked: false,
  ...overrides,
});

global.createMockMessage = (overrides = {}) => ({
  id: 'msg123',
  conversationId: 'conv123',
  type: 'text',
  text: 'Hello, this is a test message!',
  authorId: 'user123',
  authorNickname: 'User 1',
  createdAt: new Date(),
  editedAt: null,
  isDeleted: false,
  ...overrides,
});

global.createMockParticipant = (overrides = {}) => ({
  userId: 'user123',
  nickname: 'User 1',
  joinedAt: new Date(),
  lastReadAt: new Date(),
  isTyping: false,
  isMuted: false,
  role: 'member',
  ...overrides,
});

// Mock Firebase Admin SDK methods
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
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
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn(),
          })),
        })),
      })),
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn(),
        })),
      })),
      limit: jest.fn(() => ({
        get: jest.fn(),
      })),
      get: jest.fn(),
    })),
    runTransaction: jest.fn(),
  })),
}));

jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn(() => ({
    bucket: jest.fn(() => ({
      file: jest.fn(() => ({
        getSignedUrl: jest.fn(),
        delete: jest.fn(),
        getMetadata: jest.fn(),
      })),
    })),
  })),
}));

// Mock external dependencies
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req, res, next) => next());
});

jest.mock('sanitize-html', () => {
  return jest.fn((text, options) => text);
});

// Helper function to create mock Firestore document
global.createMockFirestoreDoc = (data, exists = true) => ({
  exists: () => exists,
  data: () => data,
  id: data?.id || 'doc123',
});

// Helper function to create mock Firestore query result
global.createMockFirestoreQueryResult = (docs = [], empty = false) => ({
  docs: docs.map(doc => typeof doc === 'object' ? doc : { id: doc, data: () => ({ id: doc }) }),
  empty,
  size: docs.length,
});

// Helper function to create mock Firestore transaction
global.createMockFirestoreTransaction = () => ({
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(10000);
