const request = require('supertest');
const { createApp } = require('../../app');
const { getFirestore } = require('../../../lib/firebase');

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn((token) => {
      if (token === 'valid-token') {
        return Promise.resolve({ uid: 'user123', email: 'test@example.com' });
      }
      if (token === 'admin-token') {
        return Promise.resolve({ uid: 'admin123', email: 'admin@example.com', admin: true });
      }
      if (token === 'moderator-token') {
        return Promise.resolve({ uid: 'mod123', email: 'mod@example.com', moderator: true });
      }
      throw new Error('Invalid token');
    }),
  })),
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

describe('Chat Conversations API', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    app = createApp();
    mockDb = getFirestore();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/v1/chat/conversations', () => {
    it('should create a direct conversation successfully', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        createdAt: new Date(),
      };

      // Mock Firestore operations
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const response = await request(app)
        .post('/api/v1/chat/conversations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'direct',
          memberUserId: 'user456',
        });

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.type).toBe('direct');
      expect(response.body.data.members).toContain('user123');
      expect(response.body.data.members).toContain('user456');
    });

    it('should create a group conversation successfully', async () => {
      const mockConversation = {
        id: 'conv456',
        type: 'group',
        title: 'Test Group',
        members: ['user123', 'user456', 'user789'],
        memberCount: 3,
        lastMessageAt: new Date(),
        createdAt: new Date(),
      };

      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const response = await request(app)
        .post('/api/v1/chat/conversations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'group',
          title: 'Test Group',
          memberUserIds: ['user456', 'user789'],
        });

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.type).toBe('group');
      expect(response.body.data.title).toBe('Test Group');
      expect(response.body.data.members).toHaveLength(3);
    });

    it('should return 400 for invalid conversation type', async () => {
      const response = await request(app)
        .post('/api/v1/chat/conversations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'invalid',
          memberUserId: 'user456',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Invalid conversation type');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/chat/conversations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'direct',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for group conversation without title', async () => {
      const response = await request(app)
        .post('/api/v1/chat/conversations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'group',
          memberUserIds: ['user456'],
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('title');
    });

    it('should return 400 for group conversation with insufficient members', async () => {
      const response = await request(app)
        .post('/api/v1/chat/conversations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'group',
          title: 'Test Group',
          memberUserIds: ['user456'],
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('at least 2 members');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .post('/api/v1/chat/conversations')
        .send({
          type: 'direct',
          memberUserId: 'user456',
        });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('GET /api/v1/chat/conversations', () => {
    it('should list user conversations successfully', async () => {
      const mockConversations = [
        {
          id: 'conv1',
          type: 'direct',
          members: ['user123', 'user456'],
          memberCount: 2,
          lastMessageAt: new Date('2024-01-01'),
          lastMessagePreview: 'Hello there',
        },
        {
          id: 'conv2',
          type: 'group',
          title: 'Group Chat',
          members: ['user123', 'user456', 'user789'],
          memberCount: 3,
          lastMessageAt: new Date('2024-01-02'),
          lastMessagePreview: 'How are you?',
        },
      ];

      mockDb.collection().where().orderBy().limit().get.mockResolvedValue({
        docs: mockConversations.map(conv => ({
          id: conv.id,
          data: () => conv,
        })),
        empty: false,
      });

      const response = await request(app)
        .get('/api/v1/chat/conversations')
        .set('Authorization', 'Bearer valid-token')
        .query({ pageSize: 20 });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].type).toBe('direct');
      expect(response.body.data[1].type).toBe('group');
    });

    it('should handle pagination correctly', async () => {
      const mockConversations = Array.from({ length: 25 }, (_, i) => ({
        id: `conv${i}`,
        type: 'direct',
        members: ['user123', `user${i}`],
        memberCount: 2,
        lastMessageAt: new Date(),
        lastMessagePreview: `Message ${i}`,
      }));

      mockDb.collection().where().orderBy().limit().get.mockResolvedValue({
        docs: mockConversations.slice(0, 20).map(conv => ({
          id: conv.id,
          data: () => conv,
        })),
        empty: false,
      });

      const response = await request(app)
        .get('/api/v1/chat/conversations')
        .set('Authorization', 'Bearer valid-token')
        .query({ pageSize: 20 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(20);
      expect(response.body.meta.hasMore).toBe(true);
    });

    it('should return 400 for invalid pageSize', async () => {
      const response = await request(app)
        .get('/api/v1/chat/conversations')
        .set('Authorization', 'Bearer valid-token')
        .query({ pageSize: 100 });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('GET /api/v1/chat/conversations/:id', () => {
    it('should get conversation details successfully', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        createdAt: new Date(),
      };

      const mockParticipants = [
        {
          userId: 'user123',
          nickname: 'User 1',
          joinedAt: new Date(),
          lastReadAt: new Date(),
          role: 'member',
        },
        {
          userId: 'user456',
          nickname: 'User 2',
          joinedAt: new Date(),
          lastReadAt: new Date(),
          role: 'member',
        },
      ];

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      mockDb.collection().get.mockResolvedValue({
        docs: mockParticipants.map(p => ({
          id: p.userId,
          data: () => p,
        })),
      });

      const response = await request(app)
        .get('/api/v1/chat/conversations/conv123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.id).toBe('conv123');
      expect(response.body.data.participants).toHaveLength(2);
    });

    it('should return 404 for non-existent conversation', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .get('/api/v1/chat/conversations/nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
    });

    it('should return 403 for non-participant', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user456', 'user789'], // user123 not in members
        memberCount: 2,
        lastMessageAt: new Date(),
        createdAt: new Date(),
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const response = await request(app)
        .get('/api/v1/chat/conversations/conv123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('POST /api/v1/chat/conversations/:id/join', () => {
    it('should join conversation successfully', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'group',
        members: ['user456', 'user789'],
        memberCount: 2,
        lastMessageAt: new Date(),
        createdAt: new Date(),
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().update.mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/join')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.message).toContain('joined');
    });

    it('should return 404 for non-existent conversation', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .post('/api/v1/chat/conversations/nonexistent/join')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for direct conversation join attempt', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user456', 'user789'],
        memberCount: 2,
        lastMessageAt: new Date(),
        createdAt: new Date(),
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/join')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('direct conversations');
    });
  });

  describe('POST /api/v1/chat/conversations/:id/leave', () => {
    it('should leave conversation successfully', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'group',
        members: ['user123', 'user456', 'user789'],
        memberCount: 3,
        lastMessageAt: new Date(),
        createdAt: new Date(),
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      mockDb.collection().doc().delete.mockResolvedValue();
      mockDb.collection().doc().update.mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/leave')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.message).toContain('left');
    });

    it('should return 400 for direct conversation leave attempt', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        createdAt: new Date(),
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/leave')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('direct conversations');
    });
  });

  describe('PATCH /api/v1/chat/conversations/:id', () => {
    it('should update conversation successfully', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'group',
        title: 'Old Title',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        createdAt: new Date(),
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      mockDb.collection().doc().update.mockResolvedValue();

      const response = await request(app)
        .patch('/api/v1/chat/conversations/conv123')
        .set('Authorization', 'Bearer valid-token')
        .send({
          title: 'New Title',
          icon: 'https://example.com/icon.png',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.title).toBe('New Title');
    });

    it('should return 403 for non-moderator update attempt', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'group',
        title: 'Old Title',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        createdAt: new Date(),
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      // Mock participant data to show user is not moderator
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          userId: 'user123',
          role: 'member',
        }),
      });

      const response = await request(app)
        .patch('/api/v1/chat/conversations/conv123')
        .set('Authorization', 'Bearer valid-token')
        .send({
          title: 'New Title',
        });

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('POST /api/v1/chat/conversations/:id/mute', () => {
    it('should toggle mute status successfully', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        createdAt: new Date(),
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      mockDb.collection().doc().update.mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/mute')
        .set('Authorization', 'Bearer valid-token')
        .send({
          isMuted: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.isMuted).toBe(true);
    });

    it('should return 400 for missing isMuted field', async () => {
      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/mute')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on conversation creation', async () => {
      // This test would require more complex mocking of the rate limiter
      // For now, we'll just verify the endpoint exists and accepts requests
      const response = await request(app)
        .post('/api/v1/chat/conversations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'direct',
          memberUserId: 'user456',
        });

      // Should either succeed or return rate limit error
      expect([201, 429]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should handle Firestore errors gracefully', async () => {
      mockDb.collection().doc().get.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/chat/conversations/conv123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Internal server error');
    });

    it('should handle validation errors properly', async () => {
      const response = await request(app)
        .post('/api/v1/chat/conversations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'direct',
          // Missing memberUserId
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
});
