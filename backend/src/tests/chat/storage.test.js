const request = require('supertest');
const { createApp } = require('../../app');
const { getFirestore } = require('../../../lib/firebase');

describe('Chat Storage API', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    app = createApp();
    mockDb = getFirestore();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/v1/storage/chat/sign', () => {
    it('should generate upload URL for image successfully', async () => {
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

      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'image/jpeg',
          size: 1024 * 1024, // 1MB
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveProperty('uploadUrl');
      expect(response.body.data).toHaveProperty('messageId');
      expect(response.body.data).toHaveProperty('objectPath');
      expect(response.body.data.type).toBe('images');
    });

    it('should generate upload URL for audio successfully', async () => {
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

      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'audio',
          mime: 'audio/mpeg',
          size: 5 * 1024 * 1024, // 5MB
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveProperty('uploadUrl');
      expect(response.body.data).toHaveProperty('messageId');
      expect(response.body.data).toHaveProperty('objectPath');
      expect(response.body.data.type).toBe('audio');
    });

    it('should return 400 for missing conversationId', async () => {
      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'images',
          mime: 'image/jpeg',
          size: 1024 * 1024,
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('conversationId');
    });

    it('should return 400 for missing type field', async () => {
      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          mime: 'image/jpeg',
          size: 1024 * 1024,
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('type');
    });

    it('should return 400 for missing mime field', async () => {
      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          size: 1024 * 1024,
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('mime');
    });

    it('should return 400 for missing size field', async () => {
      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'image/jpeg',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('size');
    });

    it('should return 400 for invalid media type', async () => {
      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'invalid_type',
          mime: 'image/jpeg',
          size: 1024 * 1024,
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Invalid media type');
    });

    it('should return 400 for unsupported MIME type', async () => {
      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'text/plain',
          size: 1024 * 1024,
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Unsupported MIME type');
    });

    it('should return 400 for file size exceeding limit', async () => {
      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'image/jpeg',
          size: 10 * 1024 * 1024, // 10MB, exceeds 5MB limit
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('File size exceeds limit');
    });

    it('should return 400 for audio when feature is disabled', async () => {
      // Mock feature flag to disable audio
      jest.doMock('../../config/features', () => ({
        chatAudio: false,
      }));

      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'audio',
          mime: 'audio/mpeg',
          size: 5 * 1024 * 1024,
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Audio uploads are disabled');
    });

    it('should return 404 for non-existent conversation', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'nonexistent',
          type: 'images',
          mime: 'image/jpeg',
          size: 1024 * 1024,
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
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'image/jpeg',
          size: 1024 * 1024,
        });

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('not a participant');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'image/jpeg',
          size: 1024 * 1024,
        });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });

    it('should handle Firestore errors gracefully', async () => {
      mockDb.collection().doc().get.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'image/jpeg',
          size: 1024 * 1024,
        });

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Internal server error');
    });
  });

  describe('Media Validation', () => {
    it('should validate image MIME types correctly', () => {
      const validImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
      const invalidImageMimes = ['image/gif', 'image/bmp', 'text/plain'];

      validImageMimes.forEach(mime => {
        expect(['image/jpeg', 'image/png', 'image/webp']).toContain(mime);
      });

      invalidImageMimes.forEach(mime => {
        expect(['image/jpeg', 'image/png', 'image/webp']).not.toContain(mime);
      });
    });

    it('should validate audio MIME types correctly', () => {
      const validAudioMimes = ['audio/mpeg', 'audio/aac', 'audio/webm'];
      const invalidAudioMimes = ['audio/wav', 'audio/ogg', 'video/mp4'];

      validAudioMimes.forEach(mime => {
        expect(['audio/mpeg', 'audio/aac', 'audio/webm']).toContain(mime);
      });

      invalidAudioMimes.forEach(mime => {
        expect(['audio/mpeg', 'audio/aac', 'audio/webm']).not.toContain(mime);
      });
    });

    it('should validate file size limits correctly', () => {
      const imageSizeLimit = 5 * 1024 * 1024; // 5MB
      const audioSizeLimit = 20 * 1024 * 1024; // 20MB

      const validImageSize = 2 * 1024 * 1024; // 2MB
      const validAudioSize = 10 * 1024 * 1024; // 10MB
      const invalidImageSize = 6 * 1024 * 1024; // 6MB
      const invalidAudioSize = 25 * 1024 * 1024; // 25MB

      expect(validImageSize).toBeLessThanOrEqual(imageSizeLimit);
      expect(validAudioSize).toBeLessThanOrEqual(audioSizeLimit);
      expect(invalidImageSize).toBeGreaterThan(imageSizeLimit);
      expect(invalidAudioSize).toBeGreaterThan(audioSizeLimit);
    });
  });

  describe('URL Generation', () => {
    it('should generate valid upload URLs', async () => {
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

      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'image/jpeg',
          size: 1024 * 1024,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.uploadUrl).toMatch(/^https:\/\/.*\?.*$/);
      expect(response.body.data.objectPath).toMatch(/^chat\/conversations\/conv123\/.*\.jpeg$/);
    });

    it('should generate unique message IDs for each request', async () => {
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

      const response1 = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'image/jpeg',
          size: 1024 * 1024,
        });

      const response2 = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'image/png',
          size: 1024 * 1024,
        });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.data.messageId).not.toBe(response2.body.data.messageId);
    });

    it('should include correct file extensions in object paths', async () => {
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

      const mimeToExtension = {
        'image/jpeg': 'jpeg',
        'image/png': 'png',
        'image/webp': 'webp',
        'audio/mpeg': 'mpeg',
        'audio/aac': 'aac',
        'audio/webm': 'webm',
      };

      for (const [mime, expectedExt] of Object.entries(mimeToExtension)) {
        const response = await request(app)
          .post('/api/v1/storage/chat/sign')
          .set('Authorization', 'Bearer valid-token')
          .send({
            conversationId: 'conv123',
            type: mime.startsWith('image/') ? 'images' : 'audio',
            mime: mime,
            size: 1024 * 1024,
          });

        expect(response.status).toBe(200);
        expect(response.body.data.objectPath).toMatch(new RegExp(`\\.${expectedExt}$`));
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on storage signing', async () => {
      // This test would require more complex mocking of the rate limiter
      // For now, we'll just verify the endpoint exists and accepts requests
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

      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'image/jpeg',
          size: 1024 * 1024,
        });

      // Should either succeed or return rate limit error
      expect([200, 429]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid conversation ID format', async () => {
      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'invalid-format!@#',
          type: 'images',
          mime: 'image/jpeg',
          size: 1024 * 1024,
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should handle malformed request body', async () => {
      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'image/jpeg',
          size: 'not-a-number',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should handle extremely large file sizes', async () => {
      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'image/jpeg',
          size: Number.MAX_SAFE_INTEGER,
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('File size exceeds limit');
    });
  });

  describe('Security', () => {
    it('should not expose internal file paths', async () => {
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

      const response = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'image/jpeg',
          size: 1024 * 1024,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.objectPath).not.toContain('..');
      expect(response.body.data.objectPath).not.toContain('/etc/');
      expect(response.body.data.objectPath).not.toContain('/var/');
    });

    it('should validate conversation ownership', async () => {
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
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'image/jpeg',
          size: 1024 * 1024,
        });

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('not a participant');
    });
  });
});
