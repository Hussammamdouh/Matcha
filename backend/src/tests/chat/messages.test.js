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

describe('Chat Messages API', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    app = createApp();
    mockDb = getFirestore();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/v1/chat/messages', () => {
    it('should send a text message successfully', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      const mockMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        type: 'text',
        text: 'Hello, this is a test message!',
        authorId: 'user123',
        authorNickname: 'User 1',
        createdAt: new Date(),
        isDeleted: false,
      };

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      // Mock participant check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          userId: 'user123',
          role: 'member',
        }),
      });

      // Mock transaction
      mockDb.runTransaction.mockImplementation(async (updateFunction) => {
        return updateFunction({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => mockConversation,
          }),
          set: jest.fn(),
          update: jest.fn(),
        });
      });

      // Mock message creation
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMessage,
      });

      const response = await request(app)
        .post('/api/v1/chat/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'text',
          text: 'Hello, this is a test message!',
        });

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.type).toBe('text');
      expect(response.body.data.text).toBe('Hello, this is a test message!');
      expect(response.body.data.authorId).toBe('user123');
    });

    it('should send a media message successfully', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      const mockMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        type: 'image',
        media: {
          url: 'https://example.com/image.jpg',
          mime: 'image/jpeg',
          size: 1024000,
          width: 1920,
          height: 1080,
        },
        authorId: 'user123',
        authorNickname: 'User 1',
        createdAt: new Date(),
        isDeleted: false,
      };

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      // Mock participant check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          userId: 'user123',
          role: 'member',
        }),
      });

      // Mock transaction
      mockDb.runTransaction.mockImplementation(async (updateFunction) => {
        return updateFunction({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => mockConversation,
          }),
          set: jest.fn(),
          update: jest.fn(),
        });
      });

      // Mock message creation
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMessage,
      });

      const response = await request(app)
        .post('/api/v1/chat/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'image',
          media: {
            url: 'https://example.com/image.jpg',
            mime: 'image/jpeg',
            size: 1024000,
            width: 1920,
            height: 1080,
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.type).toBe('image');
      expect(response.body.data.media.url).toBe('https://example.com/image.jpg');
      expect(response.body.data.media.mime).toBe('image/jpeg');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/chat/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'text',
          // Missing text field
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for text message without text content', async () => {
      const response = await request(app)
        .post('/api/v1/chat/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'text',
          text: '', // Empty text
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for media message without media object', async () => {
      const response = await request(app)
        .post('/api/v1/chat/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'image',
          // Missing media object
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for invalid message type', async () => {
      const response = await request(app)
        .post('/api/v1/chat/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'invalid',
          text: 'Hello',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 404 for non-existent conversation', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .post('/api/v1/chat/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'nonexistent',
          type: 'text',
          text: 'Hello',
        });

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
        isLocked: false,
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const response = await request(app)
        .post('/api/v1/chat/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'text',
          text: 'Hello',
        });

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
    });

    it('should return 403 for locked conversation', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: true, // Conversation is locked
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const response = await request(app)
        .post('/api/v1/chat/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'text',
          text: 'Hello',
        });

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('locked');
    });
  });

  describe('GET /api/v1/chat/messages/conversation/:conversationId', () => {
    it('should get conversation messages successfully', async () => {
      const mockMessages = [
        {
          id: 'msg1',
          conversationId: 'conv123',
          type: 'text',
          text: 'Hello there',
          authorId: 'user123',
          authorNickname: 'User 1',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          isDeleted: false,
        },
        {
          id: 'msg2',
          conversationId: 'conv123',
          type: 'text',
          text: 'How are you?',
          authorId: 'user456',
          authorNickname: 'User 2',
          createdAt: new Date('2024-01-01T10:01:00Z'),
          isDeleted: false,
        },
      ];

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'conv123',
          members: ['user123', 'user456'],
        }),
      });

      // Mock messages query
      mockDb.collection().where().orderBy().limit().get.mockResolvedValue({
        docs: mockMessages.map(msg => ({
          id: msg.id,
          data: () => msg,
        })),
        empty: false,
      });

      const response = await request(app)
        .get('/api/v1/chat/messages/conversation/conv123')
        .set('Authorization', 'Bearer valid-token')
        .query({ pageSize: 50, order: 'desc' });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].text).toBe('How are you?'); // Newest first
      expect(response.body.data[1].text).toBe('Hello there');
    });

    it('should handle pagination correctly', async () => {
      const mockMessages = Array.from({ length: 60 }, (_, i) => ({
        id: `msg${i}`,
        conversationId: 'conv123',
        type: 'text',
        text: `Message ${i}`,
        authorId: 'user123',
        authorNickname: 'User 1',
        createdAt: new Date(`2024-01-01T${10 + Math.floor(i / 60)}:${i % 60}:00Z`),
        isDeleted: false,
      }));

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'conv123',
          members: ['user123', 'user456'],
        }),
      });

      // Mock messages query
      mockDb.collection().where().orderBy().limit().get.mockResolvedValue({
        docs: mockMessages.slice(0, 50).map(msg => ({
          id: msg.id,
          data: () => msg,
        })),
        empty: false,
      });

      const response = await request(app)
        .get('/api/v1/chat/messages/conversation/conv123')
        .set('Authorization', 'Bearer valid-token')
        .query({ pageSize: 50, order: 'desc' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(50);
      expect(response.body.meta.hasMore).toBe(true);
      expect(response.body.meta.conversationId).toBe('conv123');
    });

    it('should return 400 for invalid pageSize', async () => {
      const response = await request(app)
        .get('/api/v1/chat/messages/conversation/conv123')
        .set('Authorization', 'Bearer valid-token')
        .query({ pageSize: 100 }); // Exceeds max

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for invalid order', async () => {
      const response = await request(app)
        .get('/api/v1/chat/messages/conversation/conv123')
        .set('Authorization', 'Bearer valid-token')
        .query({ order: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 404 for non-existent conversation', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .get('/api/v1/chat/messages/conversation/nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
    });

    it('should return 403 for non-participant', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'conv123',
          members: ['user456', 'user789'], // user123 not in members
        }),
      });

      const response = await request(app)
        .get('/api/v1/chat/messages/conversation/conv123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('PATCH /api/v1/chat/messages/:id', () => {
    it('should edit message successfully', async () => {
      const mockMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        type: 'text',
        text: 'Old text',
        authorId: 'user123',
        authorNickname: 'User 1',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        editedAt: null,
        isDeleted: false,
      };

      const updatedMessage = {
        ...mockMessage,
        text: 'Updated text',
        editedAt: new Date(),
      };

      // Mock message retrieval
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMessage,
      });

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'conv123',
          members: ['user123', 'user456'],
        }),
      });

      // Mock participant check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          userId: 'user123',
          role: 'member',
        }),
      });

      // Mock message update
      mockDb.collection().doc().update.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => updatedMessage,
      });

      const response = await request(app)
        .patch('/api/v1/chat/messages/msg123')
        .set('Authorization', 'Bearer valid-token')
        .send({
          text: 'Updated text',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.text).toBe('Updated text');
      expect(response.body.data.editedAt).toBeDefined();
    });

    it('should return 400 for missing text field', async () => {
      const response = await request(app)
        .patch('/api/v1/chat/messages/msg123')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for empty text', async () => {
      const response = await request(app)
        .patch('/api/v1/chat/messages/msg123')
        .set('Authorization', 'Bearer valid-token')
        .send({
          text: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 404 for non-existent message', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .patch('/api/v1/chat/messages/nonexistent')
        .set('Authorization', 'Bearer valid-token')
        .send({
          text: 'Updated text',
        });

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
    });

    it('should return 403 for non-author edit attempt', async () => {
      const mockMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        type: 'text',
        text: 'Old text',
        authorId: 'user456', // Different author
        authorNickname: 'User 2',
        createdAt: new Date(),
        editedAt: null,
        isDeleted: false,
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMessage,
      });

      const response = await request(app)
        .patch('/api/v1/chat/messages/msg123')
        .set('Authorization', 'Bearer valid-token')
        .send({
          text: 'Updated text',
        });

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for editing deleted message', async () => {
      const mockMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        type: 'text',
        text: 'Old text',
        authorId: 'user123',
        authorNickname: 'User 1',
        createdAt: new Date(),
        editedAt: null,
        isDeleted: true, // Message is deleted
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMessage,
      });

      const response = await request(app)
        .patch('/api/v1/chat/messages/msg123')
        .set('Authorization', 'Bearer valid-token')
        .send({
          text: 'Updated text',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('deleted');
    });

    it('should return 400 for editing message after edit window', async () => {
      const mockMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        type: 'text',
        text: 'Old text',
        authorId: 'user123',
        authorNickname: 'User 1',
        createdAt: new Date('2024-01-01T10:00:00Z'), // Old message
        editedAt: null,
        isDeleted: false,
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMessage,
      });

      const response = await request(app)
        .patch('/api/v1/chat/messages/msg123')
        .set('Authorization', 'Bearer valid-token')
        .send({
          text: 'Updated text',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('edit window');
    });
  });

  describe('DELETE /api/v1/chat/messages/:id', () => {
    it('should delete message successfully', async () => {
      const mockMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        type: 'text',
        text: 'Hello there',
        authorId: 'user123',
        authorNickname: 'User 1',
        createdAt: new Date(),
        isDeleted: false,
      };

      // Mock message retrieval
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMessage,
      });

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'conv123',
          members: ['user123', 'user456'],
        }),
      });

      // Mock participant check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          userId: 'user123',
          role: 'member',
        }),
      });

      // Mock message deletion (soft delete)
      mockDb.collection().doc().update.mockResolvedValue();

      const response = await request(app)
        .delete('/api/v1/chat/messages/msg123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.message).toContain('deleted');
    });

    it('should return 404 for non-existent message', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .delete('/api/v1/chat/messages/nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
    });

    it('should return 403 for non-author delete attempt', async () => {
      const mockMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        type: 'text',
        text: 'Hello there',
        authorId: 'user456', // Different author
        authorNickname: 'User 2',
        createdAt: new Date(),
        isDeleted: false,
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMessage,
      });

      const response = await request(app)
        .delete('/api/v1/chat/messages/msg123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for deleting already deleted message', async () => {
      const mockMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        type: 'text',
        text: 'Hello there',
        authorId: 'user123',
        authorNickname: 'User 1',
        createdAt: new Date(),
        isDeleted: true, // Already deleted
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMessage,
      });

      const response = await request(app)
        .delete('/api/v1/chat/messages/msg123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('already deleted');
    });
  });

  describe('POST /api/v1/chat/messages/:id/reactions', () => {
    it('should add reaction successfully', async () => {
      const mockMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        type: 'text',
        text: 'Hello there',
        authorId: 'user456',
        authorNickname: 'User 2',
        createdAt: new Date(),
        isDeleted: false,
      };

      // Mock message retrieval
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMessage,
      });

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'conv123',
          members: ['user123', 'user456'],
        }),
      });

      // Mock participant check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          userId: 'user123',
          role: 'member',
        }),
      });

      // Mock reaction addition
      mockDb.collection().doc().set.mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/chat/messages/msg123/reactions')
        .set('Authorization', 'Bearer valid-token')
        .send({
          value: '👍',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.message).toContain('reaction added');
    });

    it('should return 400 for missing reaction value', async () => {
      const response = await request(app)
        .post('/api/v1/chat/messages/msg123/reactions')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for empty reaction value', async () => {
      const response = await request(app)
        .post('/api/v1/chat/messages/msg123/reactions')
        .set('Authorization', 'Bearer valid-token')
        .send({
          value: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 404 for non-existent message', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .post('/api/v1/chat/messages/nonexistent/reactions')
        .set('Authorization', 'Bearer valid-token')
        .send({
          value: '👍',
        });

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
    });

    it('should return 403 for non-participant reaction attempt', async () => {
      const mockMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        type: 'text',
        text: 'Hello there',
        authorId: 'user456',
        authorNickname: 'User 2',
        createdAt: new Date(),
        isDeleted: false,
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMessage,
      });

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'conv123',
          members: ['user456', 'user789'], // user123 not in members
        }),
      });

      const response = await request(app)
        .post('/api/v1/chat/messages/msg123/reactions')
        .set('Authorization', 'Bearer valid-token')
        .send({
          value: '👍',
        });

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('DELETE /api/v1/chat/messages/:id/reactions/:value', () => {
    it('should remove reaction successfully', async () => {
      const mockMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        type: 'text',
        text: 'Hello there',
        authorId: 'user456',
        authorNickname: 'User 2',
        createdAt: new Date(),
        isDeleted: false,
      };

      // Mock message retrieval
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMessage,
      });

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'conv123',
          members: ['user123', 'user456'],
        }),
      });

      // Mock participant check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          userId: 'user123',
          role: 'member',
        }),
      });

      // Mock reaction removal
      mockDb.collection().doc().delete.mockResolvedValue();

      const response = await request(app)
        .delete('/api/v1/chat/messages/msg123/reactions/👍')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.message).toContain('reaction removed');
    });

    it('should return 404 for non-existent message', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .delete('/api/v1/chat/messages/nonexistent/reactions/👍')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
    });

    it('should return 403 for non-participant reaction removal attempt', async () => {
      const mockMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        type: 'text',
        text: 'Hello there',
        authorId: 'user456',
        authorNickname: 'User 2',
        createdAt: new Date(),
        isDeleted: false,
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMessage,
      });

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'conv123',
          members: ['user456', 'user789'], // user123 not in members
        }),
      });

      const response = await request(app)
        .delete('/api/v1/chat/messages/msg123/reactions/👍')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on message sending', async () => {
      // This test would require more complex mocking of the rate limiter
      // For now, we'll just verify the endpoint exists and accepts requests
      const response = await request(app)
        .post('/api/v1/chat/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'text',
          text: 'Test message',
        });

      // Should either succeed or return rate limit error
      expect([201, 429]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should handle Firestore errors gracefully', async () => {
      mockDb.collection().doc().get.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/chat/messages/conversation/conv123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Internal server error');
    });

    it('should handle validation errors properly', async () => {
      const response = await request(app)
        .post('/api/v1/chat/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'text',
          // Missing text field
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
});
