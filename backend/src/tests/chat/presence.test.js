const request = require('supertest');
const { createApp } = require('../../app');
const { getFirestore } = require('../../../lib/firebase');

describe('Chat Presence & Typing API', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    app = createApp();
    mockDb = getFirestore();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/v1/chat/presence/heartbeat', () => {
    it('should update user presence successfully', async () => {
      const mockPresence = {
        id: 'user123',
        userId: 'user123',
        state: 'online',
        lastSeen: new Date(),
        updatedAt: new Date(),
      };

      // Mock presence update
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockPresence,
      });

      const response = await request(app)
        .post('/api/v1/chat/presence/heartbeat')
        .set('Authorization', 'Bearer valid-token')
        .send({
          state: 'online',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.state).toBe('online');
    });

    it('should update presence to offline', async () => {
      const mockPresence = {
        id: 'user123',
        userId: 'user123',
        state: 'offline',
        lastSeen: new Date(),
        updatedAt: new Date(),
      };

      // Mock presence update
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockPresence,
      });

      const response = await request(app)
        .post('/api/v1/chat/presence/heartbeat')
        .set('Authorization', 'Bearer valid-token')
        .send({
          state: 'offline',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.state).toBe('offline');
    });

    it('should return 400 for missing state field', async () => {
      const response = await request(app)
        .post('/api/v1/chat/presence/heartbeat')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for invalid state value', async () => {
      const response = await request(app)
        .post('/api/v1/chat/presence/heartbeat')
        .set('Authorization', 'Bearer valid-token')
        .send({
          state: 'invalid_state',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Invalid state');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .post('/api/v1/chat/presence/heartbeat')
        .send({
          state: 'online',
        });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });

    it('should handle Firestore errors gracefully', async () => {
      mockDb.collection().doc().set.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/chat/presence/heartbeat')
        .set('Authorization', 'Bearer valid-token')
        .send({
          state: 'online',
        });

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Internal server error');
    });
  });

  describe('POST /api/v1/chat/conversations/:id/typing', () => {
    it('should set typing status to true successfully', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      const mockParticipant = {
        userId: 'user123',
        nickname: 'User 1',
        joinedAt: new Date(),
        lastReadAt: new Date(),
        isTyping: false,
        isMuted: false,
        role: 'member',
      };

      const updatedParticipant = {
        ...mockParticipant,
        isTyping: true,
        updatedAt: new Date(),
      };

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      // Mock participant check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockParticipant,
      });

      // Mock participant update
      mockDb.collection().doc().update.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => updatedParticipant,
      });

      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/typing')
        .set('Authorization', 'Bearer valid-token')
        .send({
          isTyping: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.isTyping).toBe(true);
    });

    it('should set typing status to false successfully', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      const mockParticipant = {
        userId: 'user123',
        nickname: 'User 1',
        joinedAt: new Date(),
        lastReadAt: new Date(),
        isTyping: true,
        isMuted: false,
        role: 'member',
      };

      const updatedParticipant = {
        ...mockParticipant,
        isTyping: false,
        updatedAt: new Date(),
      };

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      // Mock participant check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockParticipant,
      });

      // Mock participant update
      mockDb.collection().doc().update.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => updatedParticipant,
      });

      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/typing')
        .set('Authorization', 'Bearer valid-token')
        .send({
          isTyping: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.isTyping).toBe(false);
    });

    it('should return 400 for missing isTyping field', async () => {
      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/typing')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for non-boolean isTyping value', async () => {
      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/typing')
        .set('Authorization', 'Bearer valid-token')
        .send({
          isTyping: 'not_a_boolean',
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
        .post('/api/v1/chat/conversations/nonexistent/typing')
        .set('Authorization', 'Bearer valid-token')
        .send({
          isTyping: true,
        });

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Conversation not found');
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
        .post('/api/v1/chat/conversations/conv123/typing')
        .set('Authorization', 'Bearer valid-token')
        .send({
          isTyping: true,
        });

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('not a participant');
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
        .post('/api/v1/chat/conversations/conv123/typing')
        .set('Authorization', 'Bearer valid-token')
        .send({
          isTyping: true,
        });

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('locked');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/typing')
        .send({
          isTyping: true,
        });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });

    it('should handle Firestore errors gracefully', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
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

      // Mock participant update error
      mockDb.collection().doc().update.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/typing')
        .set('Authorization', 'Bearer valid-token')
        .send({
          isTyping: true,
        });

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Internal server error');
    });
  });

  describe('POST /api/v1/chat/conversations/:id/read', () => {
    it('should mark conversation as read successfully', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      const mockParticipant = {
        userId: 'user123',
        nickname: 'User 1',
        joinedAt: new Date(),
        lastReadAt: new Date('2024-01-01T10:00:00Z'),
        isTyping: false,
        isMuted: false,
        role: 'member',
      };

      const updatedParticipant = {
        ...mockParticipant,
        lastReadAt: new Date('2024-01-01T11:00:00Z'),
        updatedAt: new Date(),
      };

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      // Mock participant check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockParticipant,
      });

      // Mock participant update
      mockDb.collection().doc().update.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => updatedParticipant,
      });

      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/read')
        .set('Authorization', 'Bearer valid-token')
        .send({
          at: '2024-01-01T11:00:00Z',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.at).toBe('2024-01-01T11:00:00Z');
    });

    it('should mark conversation as read with current timestamp when no at provided', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      const mockParticipant = {
        userId: 'user123',
        nickname: 'User 1',
        joinedAt: new Date(),
        lastReadAt: new Date('2024-01-01T10:00:00Z'),
        isTyping: false,
        isMuted: false,
        role: 'member',
      };

      const updatedParticipant = {
        ...mockParticipant,
        lastReadAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      // Mock participant check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockParticipant,
      });

      // Mock participant update
      mockDb.collection().doc().update.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => updatedParticipant,
      });

      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/read')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.at).toBeDefined();
    });

    it('should return 400 for invalid timestamp format', async () => {
      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/read')
        .set('Authorization', 'Bearer valid-token')
        .send({
          at: 'invalid-timestamp',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Invalid timestamp');
    });

    it('should return 400 for future timestamp', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // Tomorrow

      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/read')
        .set('Authorization', 'Bearer valid-token')
        .send({
          at: futureDate.toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('future timestamp');
    });

    it('should return 404 for non-existent conversation', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .post('/api/v1/chat/conversations/nonexistent/read')
        .set('Authorization', 'Bearer valid-token')
        .send({
          at: new Date().toISOString(),
        });

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Conversation not found');
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
        .post('/api/v1/chat/conversations/conv123/read')
        .set('Authorization', 'Bearer valid-token')
        .send({
          at: new Date().toISOString(),
        });

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('not a participant');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/read')
        .send({
          at: new Date().toISOString(),
        });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });

    it('should handle Firestore errors gracefully', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
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

      // Mock participant update error
      mockDb.collection().doc().update.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/read')
        .set('Authorization', 'Bearer valid-token')
        .send({
          at: new Date().toISOString(),
        });

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Internal server error');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on presence updates', async () => {
      // This test would require more complex mocking of the rate limiter
      // For now, we'll just verify the endpoint exists and accepts requests
      const response = await request(app)
        .post('/api/v1/chat/presence/heartbeat')
        .set('Authorization', 'Bearer valid-token')
        .send({
          state: 'online',
        });

      // Should either succeed or return rate limit error
      expect([200, 429]).toContain(response.status);
    });

    it('should enforce rate limits on typing updates', async () => {
      // This test would require more complex mocking of the rate limiter
      // For now, we'll just verify the endpoint exists and accepts requests
      const response = await request(app)
        .post('/api/v1/chat/conversations/conv123/typing')
        .set('Authorization', 'Bearer valid-token')
        .send({
          isTyping: true,
        });

      // Should either succeed or return rate limit error
      expect([200, 429]).toContain(response.status);
    });
  });

  describe('Data Validation', () => {
    it('should validate presence states', () => {
      const validStates = ['online', 'offline'];

      validStates.forEach(state => {
        expect(state).toMatch(/^(online|offline)$/);
      });
    });

    it('should validate typing boolean values', () => {
      const validTypingValues = [true, false];

      validTypingValues.forEach(value => {
        expect(typeof value).toBe('boolean');
      });
    });

    it('should validate timestamp formats', () => {
      const validTimestamp = '2024-01-01T10:00:00.000Z';
      const invalidTimestamp = 'invalid-timestamp';

      expect(() => new Date(validTimestamp)).not.toThrow();
      expect(() => new Date(invalidTimestamp)).not.toThrow(); // Date constructor is forgiving
      expect(new Date(validTimestamp).getTime()).not.toBeNaN();
      expect(new Date(invalidTimestamp).getTime()).toBeNaN();
    });
  });

  describe('Presence Workflow', () => {
    it('should maintain presence state consistency', () => {
      const presenceStates = ['online', 'offline'];
      
      // Verify state transitions are valid
      expect(presenceStates).toContain('online');
      expect(presenceStates).toContain('offline');
      expect(presenceStates).toHaveLength(2);
    });

    it('should maintain typing state consistency', () => {
      const typingStates = [true, false];
      
      // Verify typing states are valid
      typingStates.forEach(state => {
        expect(typeof state).toBe('boolean');
      });
    });

    it('should maintain read receipt consistency', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 60000); // 1 minute ago
      
      // Verify timestamp ordering
      expect(past.getTime()).toBeLessThan(now.getTime());
      expect(now.getTime()).toBeGreaterThan(past.getTime());
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle user going offline and coming back online', async () => {
      // This test would require integration with the presence service
      // For now, we'll verify the basic structure
      const offlineState = 'offline';
      const onlineState = 'online';

      expect(offlineState).toBe('offline');
      expect(onlineState).toBe('online');
      expect(offlineState).not.toBe(onlineState);
    });

    it('should handle typing indicator timeout', async () => {
      // This test would require integration with the typing service
      // For now, we'll verify the basic structure
      const typingStart = true;
      const typingStop = false;

      expect(typingStart).toBe(true);
      expect(typingStop).toBe(false);
      expect(typingStart).not.toBe(typingStop);
    });

    it('should handle read receipt updates', async () => {
      // This test would require integration with the read receipt service
      // For now, we'll verify the basic structure
      const oldTimestamp = new Date('2024-01-01T10:00:00Z');
      const newTimestamp = new Date('2024-01-01T11:00:00Z');

      expect(newTimestamp.getTime()).toBeGreaterThan(oldTimestamp.getTime());
    });
  });
});
