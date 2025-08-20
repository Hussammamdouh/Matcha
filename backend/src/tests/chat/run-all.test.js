const request = require('supertest');
const { createApp } = require('../../app');
const { getFirestore } = require('../../../lib/firebase');

describe('Chat System Integration Tests', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    app = createApp();
    mockDb = getFirestore();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('End-to-End Chat Workflow', () => {
    it('should complete full chat conversation lifecycle', async () => {
      // Step 1: Create a conversation
      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUser1 = {
        uid: 'user123',
        email: 'user1@example.com',
        displayName: 'User 1',
      };

      const mockUser2 = {
        uid: 'user456',
        email: 'user2@example.com',
        displayName: 'User 2',
      };

      // Mock conversation creation
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      // Mock user checks
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockUser1,
      });

      const createResponse = await request(app)
        .post('/api/v1/chat/conversations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'direct',
          memberIds: ['user456'],
        });

      expect(createResponse.status).toBe(200);
      expect(createResponse.body.ok).toBe(true);
      expect(createResponse.body.data.type).toBe('direct');

      // Step 2: Send a message
      const mockMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        authorId: 'user123',
        text: 'Hello! How are you?',
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      };

      // Mock message creation
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMessage,
      });

      const messageResponse = await request(app)
        .post('/api/v1/chat/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          text: 'Hello! How are you?',
        });

      expect(messageResponse.status).toBe(200);
      expect(messageResponse.body.ok).toBe(true);
      expect(messageResponse.body.data.text).toBe('Hello! How are you?');

      // Step 3: Add a reaction
      const mockReaction = {
        id: 'reaction123',
        messageId: 'msg123',
        userId: 'user456',
        value: '👍',
        createdAt: new Date(),
      };

      // Mock reaction creation
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockReaction,
      });

      const reactionResponse = await request(app)
        .post('/api/v1/chat/messages/msg123/reactions')
        .set('Authorization', 'Bearer valid-token')
        .send({
          value: '👍',
        });

      expect(reactionResponse.status).toBe(200);
      expect(reactionResponse.body.ok).toBe(true);
      expect(reactionResponse.body.data.value).toBe('👍');

      // Step 4: Update presence
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

      const presenceResponse = await request(app)
        .post('/api/v1/chat/presence/heartbeat')
        .set('Authorization', 'Bearer valid-token')
        .send({
          state: 'online',
        });

      expect(presenceResponse.status).toBe(200);
      expect(presenceResponse.body.ok).toBe(true);
      expect(presenceResponse.body.data.state).toBe('online');

      // Step 5: Mark as read
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

      // Mock participant update
      mockDb.collection().doc().update.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => updatedParticipant,
      });

      const readResponse = await request(app)
        .post('/api/v1/chat/conversations/conv123/read')
        .set('Authorization', 'Bearer valid-token')
        .send({
          at: '2024-01-01T11:00:00Z',
        });

      expect(readResponse.status).toBe(200);
      expect(readResponse.body.ok).toBe(true);
      expect(readResponse.body.data.at).toBe('2024-01-01T11:00:00Z');
    });

    it('should handle group conversation with multiple participants', async () => {
      // Step 1: Create a group conversation
      const mockGroupConversation = {
        id: 'group123',
        type: 'group',
        name: 'Test Group',
        description: 'A test group conversation',
        members: ['user123', 'user456', 'user789'],
        memberCount: 3,
        lastMessageAt: new Date(),
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock group conversation creation
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockGroupConversation,
      });

      const createResponse = await request(app)
        .post('/api/v1/chat/conversations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'group',
          name: 'Test Group',
          description: 'A test group conversation',
          memberIds: ['user456', 'user789'],
        });

      expect(createResponse.status).toBe(200);
      expect(createResponse.body.ok).toBe(true);
      expect(createResponse.body.data.type).toBe('group');
      expect(createResponse.body.data.name).toBe('Test Group');

      // Step 2: Send multiple messages
      const messages = [
        { text: 'Hello everyone!' },
        { text: 'How is everyone doing?' },
        { text: 'Great to be here!' },
      ];

      for (const messageData of messages) {
        const mockMessage = {
          id: `msg${Math.random().toString(36).substr(2, 9)}`,
          conversationId: 'group123',
          authorId: 'user123',
          text: messageData.text,
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeleted: false,
        };

        // Mock message creation
        mockDb.collection().doc().set.mockResolvedValue();
        mockDb.collection().doc().get.mockResolvedValue({
          exists: true,
          data: () => mockMessage,
        });

        const messageResponse = await request(app)
          .post('/api/v1/chat/messages')
          .set('Authorization', 'Bearer valid-token')
          .send({
            conversationId: 'group123',
            text: messageData.text,
          });

        expect(messageResponse.status).toBe(200);
        expect(messageResponse.body.ok).toBe(true);
        expect(messageResponse.body.data.text).toBe(messageData.text);
      }

      // Step 3: Get conversation messages
      const mockMessages = messages.map((msg, index) => ({
        id: `msg${index + 1}`,
        conversationId: 'group123',
        authorId: 'user123',
        text: msg.text,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      }));

      // Mock messages query
      mockDb.collection().where().orderBy().limit().get.mockResolvedValue({
        docs: mockMessages.map(msg => ({
          id: msg.id,
          data: () => msg,
        })),
      });

      const messagesResponse = await request(app)
        .get('/api/v1/chat/messages/conversation/group123')
        .set('Authorization', 'Bearer valid-token');

      expect(messagesResponse.status).toBe(200);
      expect(messagesResponse.body.ok).toBe(true);
      expect(messagesResponse.body.data).toHaveLength(3);
    });

    it('should handle user blocking and unblocking', async () => {
      // Step 1: Block a user
      const mockBlock = {
        id: 'block123',
        userId: 'user123',
        blockedUserId: 'user456',
        reason: 'Inappropriate behavior',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock block creation
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockBlock,
      });

      const blockResponse = await request(app)
        .post('/api/v1/chat/blocks')
        .set('Authorization', 'Bearer valid-token')
        .send({
          blockedUserId: 'user456',
          reason: 'Inappropriate behavior',
        });

      expect(blockResponse.status).toBe(200);
      expect(blockResponse.body.ok).toBe(true);
      expect(blockResponse.body.data.blockedUserId).toBe('user456');

      // Step 2: List blocked users
      const mockBlocks = [mockBlock];

      // Mock blocks query
      mockDb.collection().where().orderBy().get.mockResolvedValue({
        docs: mockBlocks.map(block => ({
          id: block.id,
          data: () => block,
        })),
      });

      const listResponse = await request(app)
        .get('/api/v1/chat/blocks')
        .set('Authorization', 'Bearer valid-token');

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.ok).toBe(true);
      expect(listResponse.body.data).toHaveLength(1);
      expect(listResponse.body.data[0].blockedUserId).toBe('user456');

      // Step 3: Unblock user
      // Mock block deletion
      mockDb.collection().doc().delete.mockResolvedValue();

      const unblockResponse = await request(app)
        .delete('/api/v1/chat/blocks/user456')
        .set('Authorization', 'Bearer valid-token');

      expect(unblockResponse.status).toBe(200);
      expect(unblockResponse.body.ok).toBe(true);
      expect(unblockResponse.body.data.message).toContain('unblocked');
    });

    it('should handle content reporting workflow', async () => {
      // Step 1: Create a report
      const mockReport = {
        id: 'report123',
        type: 'message',
        reason: 'spam',
        status: 'pending',
        reporterId: 'user123',
        targetId: 'msg456',
        conversationId: 'conv123',
        note: 'This message contains spam content',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock report creation
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockReport,
      });

      const reportResponse = await request(app)
        .post('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'message',
          reason: 'spam',
          targetId: 'msg456',
          conversationId: 'conv123',
          note: 'This message contains spam content',
        });

      expect(reportResponse.status).toBe(200);
      expect(reportResponse.body.ok).toBe(true);
      expect(reportResponse.body.data.type).toBe('message');
      expect(reportResponse.body.data.status).toBe('pending');

      // Step 2: Admin reviews and resolves report
      const mockAdminUser = {
        uid: 'admin123',
        role: 'admin',
      };

      const updatedReport = {
        ...mockReport,
        status: 'resolved',
        resolutionNote: 'Content removed, user warned',
        resolvedAt: new Date(),
        resolvedBy: 'admin123',
      };

      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockAdminUser,
      });

      // Mock report update
      mockDb.collection().doc().update.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => updatedReport,
      });

      const resolveResponse = await request(app)
        .patch('/api/v1/admin/chat/reports/report123/status')
        .set('Authorization', 'Bearer valid-token')
        .send({
          status: 'resolved',
          resolutionNote: 'Content removed, user warned',
        });

      expect(resolveResponse.status).toBe(200);
      expect(resolveResponse.body.ok).toBe(true);
      expect(resolveResponse.body.data.status).toBe('resolved');
      expect(resolveResponse.body.data.resolutionNote).toBe('Content removed, user warned');
    });

    it('should handle media upload workflow', async () => {
      // Step 1: Generate upload URL
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

      const uploadResponse = await request(app)
        .post('/api/v1/storage/chat/sign')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          type: 'images',
          mime: 'image/jpeg',
          size: 1024 * 1024, // 1MB
        });

      expect(uploadResponse.status).toBe(200);
      expect(uploadResponse.body.ok).toBe(true);
      expect(uploadResponse.body.data).toHaveProperty('uploadUrl');
      expect(uploadResponse.body.data).toHaveProperty('messageId');
      expect(uploadResponse.body.data).toHaveProperty('objectPath');

      // Step 2: Send message with media
      const mockMediaMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        authorId: 'user123',
        text: 'Check out this image!',
        media: {
          type: 'image',
          url: 'https://example.com/image.jpg',
          thumbnail: 'https://example.com/thumb.jpg',
          size: 1024 * 1024,
          mimeType: 'image/jpeg',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      };

      // Mock message creation
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMediaMessage,
      });

      const mediaMessageResponse = await request(app)
        .post('/api/v1/chat/messages')
        .set('Authorization', 'Bearer valid-token')
        .send({
          conversationId: 'conv123',
          text: 'Check out this image!',
          media: {
            type: 'image',
            url: 'https://example.com/image.jpg',
            thumbnail: 'https://example.com/thumb.jpg',
            size: 1024 * 1024,
            mimeType: 'image/jpeg',
          },
        });

      expect(mediaMessageResponse.status).toBe(200);
      expect(mediaMessageResponse.body.ok).toBe(true);
      expect(mediaMessageResponse.body.data.media.type).toBe('image');
      expect(mediaMessageResponse.body.data.media.url).toBe('https://example.com/image.jpg');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle rate limiting gracefully', async () => {
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

      // Send multiple messages rapidly to trigger rate limiting
      const promises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/v1/chat/messages')
          .set('Authorization', 'Bearer valid-token')
          .send({
            conversationId: 'conv123',
            text: `Message ${i + 1}`,
          })
      );

      const responses = await Promise.all(promises);

      // At least some should succeed, some might be rate limited
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount).toBeGreaterThan(0);
      expect(successCount + rateLimitedCount).toBe(5);
    });

    it('should handle concurrent operations correctly', async () => {
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

      // Mock message creation
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'msg123',
          conversationId: 'conv123',
          authorId: 'user123',
          text: 'Test message',
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeleted: false,
        }),
      });

      // Perform multiple operations concurrently
      const operations = [
        // Send message
        request(app)
          .post('/api/v1/chat/messages')
          .set('Authorization', 'Bearer valid-token')
          .send({
            conversationId: 'conv123',
            text: 'Test message',
          }),
        // Update presence
        request(app)
          .post('/api/v1/chat/presence/heartbeat')
          .set('Authorization', 'Bearer valid-token')
          .send({
            state: 'online',
          }),
        // Mark as read
        request(app)
          .post('/api/v1/chat/conversations/conv123/read')
          .set('Authorization', 'Bearer valid-token')
          .send({
            at: new Date().toISOString(),
          }),
      ];

      const results = await Promise.all(operations);

      // All operations should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.ok).toBe(true);
      });
    });

    it('should handle network failures gracefully', async () => {
      // Mock Firestore connection error
      mockDb.collection().doc().get.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .get('/api/v1/chat/conversations/conv123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Internal server error');
    });

    it('should handle malformed requests gracefully', async () => {
      const malformedRequests = [
        { body: {}, expectedError: 'conversationId' },
        { body: { conversationId: '' }, expectedError: 'conversationId' },
        { body: { conversationId: 'conv123' }, expectedError: 'text' },
        { body: { conversationId: 'conv123', text: '' }, expectedError: 'text' },
        { body: { conversationId: 'conv123', text: 'a'.repeat(5001) }, expectedError: 'length' },
      ];

      for (const requestData of malformedRequests) {
        const response = await request(app)
          .post('/api/v1/chat/messages')
          .set('Authorization', 'Bearer valid-token')
          .send(requestData.body);

        expect(response.status).toBe(400);
        expect(response.body.ok).toBe(false);
        expect(response.body.error).toContain(requestData.expectedError);
      }
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle large conversation lists efficiently', async () => {
      const mockConversations = Array.from({ length: 100 }, (_, i) => ({
        id: `conv${i + 1}`,
        type: 'direct',
        members: ['user123', `user${i + 456}`],
        memberCount: 2,
        lastMessageAt: new Date(Date.now() - i * 60000), // Staggered timestamps
        isLocked: false,
        createdAt: new Date(Date.now() - i * 3600000), // Staggered creation times
        updatedAt: new Date(),
      }));

      // Mock conversations query with pagination
      mockDb.collection().orderBy().limit().get.mockResolvedValue({
        docs: mockConversations.slice(0, 20).map(conv => ({
          id: conv.id,
          data: () => conv,
        })),
      });

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/v1/chat/conversations?pageSize=20&page=1')
        .set('Authorization', 'Bearer valid-token');
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(20);
      
      // Response should be reasonably fast (under 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle message pagination efficiently', async () => {
      const mockMessages = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg${i + 1}`,
        conversationId: 'conv123',
        authorId: `user${(i % 3) + 123}`,
        text: `Message ${i + 1}`,
        createdAt: new Date(Date.now() - i * 60000), // Staggered timestamps
        updatedAt: new Date(),
        isDeleted: false,
      }));

      // Mock messages query with pagination
      mockDb.collection().where().orderBy().limit().get.mockResolvedValue({
        docs: mockMessages.slice(0, 50).map(msg => ({
          id: msg.id,
          data: () => msg,
        })),
      });

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/v1/chat/messages/conversation/conv123?pageSize=50&page=1')
        .set('Authorization', 'Bearer valid-token');
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(50);
      
      // Response should be reasonably fast (under 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
