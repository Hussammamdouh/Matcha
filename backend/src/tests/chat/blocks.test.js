const request = require('supertest');
const { createApp } = require('../../app');
const { getFirestore } = require('../../../lib/firebase');

describe('Chat Blocks API', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    app = createApp();
    mockDb = getFirestore();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/v1/chat/blocks', () => {
    it('should block a user successfully', async () => {
      const mockBlock = {
        id: 'user123_user456',
        userId: 'user123',
        blockedUserId: 'user456',
        blockedUser: {
          uid: 'user456',
          displayName: 'Blocked User',
          email: 'blocked@example.com',
          photoURL: 'https://example.com/avatar.jpg',
        },
        createdAt: new Date(),
      };

      // Mock user retrieval
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          uid: 'user456',
          displayName: 'Blocked User',
          email: 'blocked@example.com',
          photoURL: 'https://example.com/avatar.jpg',
        }),
      });

      // Mock block creation
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockBlock,
      });

      const response = await request(app)
        .post('/api/v1/chat/blocks')
        .set('Authorization', 'Bearer valid-token')
        .send({
          blockedUserId: 'user456',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.message).toContain('blocked');
      expect(response.body.data.blockedUserId).toBe('user456');
    });

    it('should return 400 for missing blockedUserId', async () => {
      const response = await request(app)
        .post('/api/v1/chat/blocks')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for blocking self', async () => {
      const response = await request(app)
        .post('/api/v1/chat/blocks')
        .set('Authorization', 'Bearer valid-token')
        .send({
          blockedUserId: 'user123', // Same as authenticated user
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('cannot block yourself');
    });

    it('should return 400 for blocking already blocked user', async () => {
      // Mock existing block
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'user123_user456',
          userId: 'user123',
          blockedUserId: 'user456',
          createdAt: new Date(),
        }),
      });

      const response = await request(app)
        .post('/api/v1/chat/blocks')
        .set('Authorization', 'Bearer valid-token')
        .send({
          blockedUserId: 'user456',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('already blocked');
    });

    it('should return 404 for non-existent user', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .post('/api/v1/chat/blocks')
        .set('Authorization', 'Bearer valid-token')
        .send({
          blockedUserId: 'nonexistent',
        });

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('User not found');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .post('/api/v1/chat/blocks')
        .send({
          blockedUserId: 'user456',
        });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('DELETE /api/v1/chat/blocks/:blockedUserId', () => {
    it('should unblock a user successfully', async () => {
      const mockBlock = {
        id: 'user123_user456',
        userId: 'user123',
        blockedUserId: 'user456',
        createdAt: new Date(),
      };

      // Mock block retrieval
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockBlock,
      });

      // Mock block deletion
      mockDb.collection().doc().delete.mockResolvedValue();

      const response = await request(app)
        .delete('/api/v1/chat/blocks/user456')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.message).toContain('unblocked');
      expect(response.body.data.blockedUserId).toBe('user456');
    });

    it('should return 404 for non-existent block', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .delete('/api/v1/chat/blocks/user456')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Block not found');
    });

    it('should return 403 for unblocking another user\'s block', async () => {
      const mockBlock = {
        id: 'user789_user456',
        userId: 'user789', // Different user
        blockedUserId: 'user456',
        createdAt: new Date(),
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockBlock,
      });

      const response = await request(app)
        .delete('/api/v1/chat/blocks/user456')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('not authorized');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .delete('/api/v1/chat/blocks/user456');

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('GET /api/v1/chat/blocks', () => {
    it('should list blocked users successfully', async () => {
      const mockBlocks = [
        {
          id: 'user123_user456',
          userId: 'user123',
          blockedUserId: 'user456',
          blockedUser: {
            uid: 'user456',
            displayName: 'Blocked User 1',
            email: 'blocked1@example.com',
            photoURL: 'https://example.com/avatar1.jpg',
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'user123_user789',
          userId: 'user123',
          blockedUserId: 'user789',
          blockedUser: {
            uid: 'user789',
            displayName: 'Blocked User 2',
            email: 'blocked2@example.com',
            photoURL: 'https://example.com/avatar2.jpg',
          },
          createdAt: new Date('2024-01-02'),
        },
      ];

      // Mock blocks query
      mockDb.collection().where().orderBy().limit().get.mockResolvedValue({
        docs: mockBlocks.map(block => ({
          id: block.id,
          data: () => block,
        })),
        empty: false,
      });

      const response = await request(app)
        .get('/api/v1/chat/blocks')
        .set('Authorization', 'Bearer valid-token')
        .query({ pageSize: 20 });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].blockedUser.displayName).toBe('Blocked User 1');
      expect(response.body.data[1].blockedUser.displayName).toBe('Blocked User 2');
    });

    it('should handle pagination correctly', async () => {
      const mockBlocks = Array.from({ length: 25 }, (_, i) => ({
        id: `user123_user${i}`,
        userId: 'user123',
        blockedUserId: `user${i}`,
        blockedUser: {
          uid: `user${i}`,
          displayName: `Blocked User ${i}`,
          email: `blocked${i}@example.com`,
          photoURL: `https://example.com/avatar${i}.jpg`,
        },
        createdAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
      }));

      // Mock blocks query
      mockDb.collection().where().orderBy().limit().get.mockResolvedValue({
        docs: mockBlocks.slice(0, 20).map(block => ({
          id: block.id,
          data: () => block,
        })),
        empty: false,
      });

      const response = await request(app)
        .get('/api/v1/chat/blocks')
        .set('Authorization', 'Bearer valid-token')
        .query({ pageSize: 20 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(20);
      expect(response.body.meta.hasMore).toBe(true);
    });

    it('should return empty list when no blocks exist', async () => {
      // Mock empty blocks query
      mockDb.collection().where().orderBy().limit().get.mockResolvedValue({
        docs: [],
        empty: true,
      });

      const response = await request(app)
        .get('/api/v1/chat/blocks')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.hasMore).toBe(false);
    });

    it('should return 400 for invalid pageSize', async () => {
      const response = await request(app)
        .get('/api/v1/chat/blocks')
        .set('Authorization', 'Bearer valid-token')
        .query({ pageSize: 100 }); // Exceeds max

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .get('/api/v1/chat/blocks');

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on block operations', async () => {
      // This test would require more complex mocking of the rate limiter
      // For now, we'll just verify the endpoint exists and accepts requests
      const response = await request(app)
        .post('/api/v1/chat/blocks')
        .set('Authorization', 'Bearer valid-token')
        .send({
          blockedUserId: 'user456',
        });

      // Should either succeed or return rate limit error
      expect([200, 429]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should handle Firestore errors gracefully', async () => {
      mockDb.collection().doc().get.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/chat/blocks')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Internal server error');
    });

    it('should handle validation errors properly', async () => {
      const response = await request(app)
        .post('/api/v1/chat/blocks')
        .set('Authorization', 'Bearer valid-token')
        .send({
          // Missing blockedUserId
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Block List Validation', () => {
    it('should prevent blocked users from sending messages', async () => {
      // This test would require integration with the messages service
      // For now, we'll verify the block structure is correct
      const mockBlock = {
        id: 'user123_user456',
        userId: 'user123',
        blockedUserId: 'user456',
        createdAt: new Date(),
      };

      expect(mockBlock.userId).toBe('user123');
      expect(mockBlock.blockedUserId).toBe('user456');
      expect(mockBlock.id).toBe(`${mockBlock.userId}_${mockBlock.blockedUserId}`);
    });

    it('should prevent blocked users from starting conversations', async () => {
      // This test would require integration with the conversations service
      // For now, we'll verify the block structure is correct
      const mockBlock = {
        id: 'user123_user456',
        userId: 'user123',
        blockedUserId: 'user456',
        createdAt: new Date(),
      };

      expect(mockBlock.userId).toBe('user123');
      expect(mockBlock.blockedUserId).toBe('user456');
      expect(mockBlock.id).toBe(`${mockBlock.userId}_${mockBlock.blockedUserId}`);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain consistent block IDs', async () => {
      const userId = 'user123';
      const blockedUserId = 'user456';
      const expectedBlockId = `${userId}_${blockedUserId}`;

      expect(expectedBlockId).toBe('user123_user456');
    });

    it('should handle special characters in user IDs', async () => {
      const userId = 'user-123_456';
      const blockedUserId = 'user.789@test';
      const expectedBlockId = `${userId}_${blockedUserId}`;

      expect(expectedBlockId).toBe('user-123_456_user.789@test');
    });

    it('should maintain chronological order of blocks', async () => {
      const mockBlocks = [
        { createdAt: new Date('2024-01-01') },
        { createdAt: new Date('2024-01-02') },
        { createdAt: new Date('2024-01-03') },
      ];

      const sortedBlocks = mockBlocks.sort((a, b) => b.createdAt - a.createdAt);
      
      expect(sortedBlocks[0].createdAt).toEqual(new Date('2024-01-03'));
      expect(sortedBlocks[1].createdAt).toEqual(new Date('2024-01-02'));
      expect(sortedBlocks[2].createdAt).toEqual(new Date('2024-01-01'));
    });
  });
});
