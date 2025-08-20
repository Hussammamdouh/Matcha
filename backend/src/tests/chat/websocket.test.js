const request = require('supertest');
const { createApp } = require('../../app');
const { getFirestore } = require('../../../lib/firebase');
const { Server } = require('socket.io');
const { createServer } = require('http');

describe('Chat WebSocket API', () => {
  let app;
  let server;
  let io;
  let mockDb;

  beforeEach(() => {
    app = createApp();
    server = createServer(app);
    io = new Server(server);
    mockDb = getFirestore();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (io) {
      io.close();
    }
    if (server) {
      server.close();
    }
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection successfully', (done) => {
      const client = io.connect('http://localhost:3000');

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        done();
      });

      client.on('connect_error', (error) => {
        done.fail(`Connection failed: ${error.message}`);
      });
    });

    it('should handle authentication via token', (done) => {
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'Test User',
      };

      // Mock Firebase Auth verification
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockUser);

      const client = io.connect('http://localhost:3000', {
        auth: {
          token: 'valid-firebase-token',
        },
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-firebase-token');
        client.disconnect();
        done();
      });

      client.on('connect_error', (error) => {
        done.fail(`Connection failed: ${error.message}`);
      });
    });

    it('should reject connection with invalid token', (done) => {
      const mockVerifyIdToken = jest.fn().mockRejectedValue(new Error('Invalid token'));

      const client = io.connect('http://localhost:3000', {
        auth: {
          token: 'invalid-token',
        },
      });

      client.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        expect(mockVerifyIdToken).toHaveBeenCalledWith('invalid-token');
        done();
      });
    });
  });

  describe('Room Management', () => {
    it('should join conversation room successfully', (done) => {
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'Test User',
      };

      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      // Mock Firebase Auth verification
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockUser);

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const client = io.connect('http://localhost:3000', {
        auth: {
          token: 'valid-token',
        },
      });

      client.on('connect', () => {
        client.emit('join_conversation', { conversationId: 'conv123' });

        client.on('joined_conversation', (data) => {
          expect(data.conversationId).toBe('conv123');
          expect(data.userId).toBe('user123');
          client.disconnect();
          done();
        });
      });
    });

    it('should leave conversation room successfully', (done) => {
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'Test User',
      };

      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      // Mock Firebase Auth verification
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockUser);

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const client = io.connect('http://localhost:3000', {
        auth: {
          token: 'valid-token',
        },
      });

      client.on('connect', () => {
        // First join the conversation
        client.emit('join_conversation', { conversationId: 'conv123' });

        client.on('joined_conversation', () => {
          // Then leave it
          client.emit('leave_conversation', { conversationId: 'conv123' });

          client.on('left_conversation', (data) => {
            expect(data.conversationId).toBe('conv123');
            expect(data.userId).toBe('user123');
            client.disconnect();
            done();
          });
        });
      });
    });

    it('should reject joining non-existent conversation', (done) => {
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'Test User',
      };

      // Mock Firebase Auth verification
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockUser);

      // Mock conversation not found
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const client = io.connect('http://localhost:3000', {
        auth: {
          token: 'valid-token',
        },
      });

      client.on('connect', () => {
        client.emit('join_conversation', { conversationId: 'nonexistent' });

        client.on('error', (data) => {
          expect(data.error).toContain('Conversation not found');
          client.disconnect();
          done();
        });
      });
    });

    it('should reject joining conversation as non-participant', (done) => {
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'Test User',
      };

      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user456', 'user789'], // user123 not in members
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      // Mock Firebase Auth verification
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockUser);

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const client = io.connect('http://localhost:3000', {
        auth: {
          token: 'valid-token',
        },
      });

      client.on('connect', () => {
        client.emit('join_conversation', { conversationId: 'conv123' });

        client.on('error', (data) => {
          expect(data.error).toContain('not a participant');
          client.disconnect();
          done();
        });
      });
    });
  });

  describe('Typing Indicators', () => {
    it('should broadcast typing start to conversation participants', (done) => {
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'Test User',
      };

      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      // Mock Firebase Auth verification
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockUser);

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const client1 = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token-1' },
      });

      const client2 = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token-2' },
      });

      client1.on('connect', () => {
        client1.emit('join_conversation', { conversationId: 'conv123' });

        client1.on('joined_conversation', () => {
          client2.on('connect', () => {
            client2.emit('join_conversation', { conversationId: 'conv123' });

            client2.on('joined_conversation', () => {
              // Start typing
              client1.emit('typing_start', { conversationId: 'conv123' });

              client2.on('user_typing', (data) => {
                expect(data.conversationId).toBe('conv123');
                expect(data.userId).toBe('user123');
                expect(data.isTyping).toBe(true);
                client1.disconnect();
                client2.disconnect();
                done();
              });
            });
          });
        });
      });
    });

    it('should broadcast typing stop to conversation participants', (done) => {
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'Test User',
      };

      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      // Mock Firebase Auth verification
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockUser);

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const client1 = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token-1' },
      });

      const client2 = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token-2' },
      });

      client1.on('connect', () => {
        client1.emit('join_conversation', { conversationId: 'conv123' });

        client1.on('joined_conversation', () => {
          client2.on('connect', () => {
            client2.emit('join_conversation', { conversationId: 'conv123' });

            client2.on('joined_conversation', () => {
              // Stop typing
              client1.emit('typing_stop', { conversationId: 'conv123' });

              client2.on('user_typing', (data) => {
                expect(data.conversationId).toBe('conv123');
                expect(data.userId).toBe('user123');
                expect(data.isTyping).toBe(false);
                client1.disconnect();
                client2.disconnect();
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('Presence Updates', () => {
    it('should broadcast presence update to conversation participants', (done) => {
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'Test User',
      };

      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      // Mock Firebase Auth verification
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockUser);

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const client1 = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token-1' },
      });

      const client2 = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token-2' },
      });

      client1.on('connect', () => {
        client1.emit('join_conversation', { conversationId: 'conv123' });

        client1.on('joined_conversation', () => {
          client2.on('connect', () => {
            client2.emit('join_conversation', { conversationId: 'conv123' });

            client2.on('joined_conversation', () => {
              // Update presence
              client1.emit('presence_update', { 
                conversationId: 'conv123',
                state: 'online'
              });

              client2.on('user_presence', (data) => {
                expect(data.conversationId).toBe('conv123');
                expect(data.userId).toBe('user123');
                expect(data.state).toBe('online');
                client1.disconnect();
                client2.disconnect();
                done();
              });
            });
          });
        });
      });
    });

    it('should handle offline presence update', (done) => {
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'Test User',
      };

      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      // Mock Firebase Auth verification
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockUser);

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const client1 = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token-1' },
      });

      const client2 = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token-2' },
      });

      client1.on('connect', () => {
        client1.emit('join_conversation', { conversationId: 'conv123' });

        client1.on('joined_conversation', () => {
          client2.on('connect', () => {
            client2.emit('join_conversation', { conversationId: 'conv123' });

            client2.on('joined_conversation', () => {
              // Update presence to offline
              client1.emit('presence_update', { 
                conversationId: 'conv123',
                state: 'offline'
              });

              client2.on('user_presence', (data) => {
                expect(data.conversationId).toBe('conv123');
                expect(data.userId).toBe('user123');
                expect(data.state).toBe('offline');
                client1.disconnect();
                client2.disconnect();
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('Message Broadcasting', () => {
    it('should broadcast new message to conversation participants', (done) => {
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'Test User',
      };

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
        authorId: 'user123',
        text: 'Hello world!',
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      };

      // Mock Firebase Auth verification
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockUser);

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const client1 = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token-1' },
      });

      const client2 = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token-2' },
      });

      client1.on('connect', () => {
        client1.emit('join_conversation', { conversationId: 'conv123' });

        client1.on('joined_conversation', () => {
          client2.on('connect', () => {
            client2.emit('join_conversation', { conversationId: 'conv123' });

            client2.on('joined_conversation', () => {
              // Broadcast new message
              client1.emit('new_message', mockMessage);

              client2.on('message_received', (data) => {
                expect(data.message.id).toBe('msg123');
                expect(data.message.text).toBe('Hello world!');
                expect(data.message.authorId).toBe('user123');
                expect(data.conversationId).toBe('conv123');
                client1.disconnect();
                client2.disconnect();
                done();
              });
            });
          });
        });
      });
    });

    it('should handle message editing', (done) => {
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'Test User',
      };

      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      const mockEditedMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        authorId: 'user123',
        text: 'Hello world! (edited)',
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
        editedAt: new Date(),
      };

      // Mock Firebase Auth verification
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockUser);

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const client1 = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token-1' },
      });

      const client2 = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token-2' },
      });

      client1.on('connect', () => {
        client1.emit('join_conversation', { conversationId: 'conv123' });

        client1.on('joined_conversation', () => {
          client2.on('connect', () => {
            client2.emit('join_conversation', { conversationId: 'conv123' });

            client2.on('joined_conversation', () => {
              // Broadcast edited message
              client1.emit('message_edited', mockEditedMessage);

              client2.on('message_updated', (data) => {
                expect(data.message.id).toBe('msg123');
                expect(data.message.text).toBe('Hello world! (edited)');
                expect(data.message.editedAt).toBeDefined();
                expect(data.conversationId).toBe('conv123');
                client1.disconnect();
                client2.disconnect();
                done();
              });
            });
          });
        });
      });
    });

    it('should handle message deletion', (done) => {
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'Test User',
      };

      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      const mockDeletedMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        authorId: 'user123',
        isDeleted: true,
        deletedAt: new Date(),
      };

      // Mock Firebase Auth verification
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockUser);

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const client1 = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token-1' },
      });

      const client2 = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token-2' },
      });

      client1.on('connect', () => {
        client1.emit('join_conversation', { conversationId: 'conv123' });

        client1.on('joined_conversation', () => {
          client2.on('connect', () => {
            client2.emit('join_conversation', { conversationId: 'conv123' });

            client2.on('joined_conversation', () => {
              // Broadcast deleted message
              client1.emit('message_deleted', mockDeletedMessage);

              client2.on('message_deleted', (data) => {
                expect(data.message.id).toBe('msg123');
                expect(data.message.isDeleted).toBe(true);
                expect(data.message.deletedAt).toBeDefined();
                expect(data.conversationId).toBe('conv123');
                client1.disconnect();
                client2.disconnect();
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid event types gracefully', (done) => {
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'Test User',
      };

      // Mock Firebase Auth verification
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockUser);

      const client = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token' },
      });

      client.on('connect', () => {
        // Emit invalid event
        client.emit('invalid_event', { data: 'test' });

        client.on('error', (data) => {
          expect(data.error).toContain('Unknown event type');
          client.disconnect();
          done();
        });
      });
    });

    it('should handle malformed message data', (done) => {
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'Test User',
      };

      const mockConversation = {
        id: 'conv123',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      // Mock Firebase Auth verification
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockUser);

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      const client = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token' },
      });

      client.on('connect', () => {
        client.emit('join_conversation', { conversationId: 'conv123' });

        client.on('joined_conversation', () => {
          // Emit malformed message
          client.emit('new_message', { invalid: 'data' });

          client.on('error', (data) => {
            expect(data.error).toContain('Invalid message data');
            client.disconnect();
            done();
          });
        });
      });
    });

    it('should handle connection timeouts', (done) => {
      const client = io.connect('http://localhost:3000', {
        timeout: 1000, // 1 second timeout
      });

      client.on('connect_timeout', () => {
        expect(client.connected).toBe(false);
        done();
      });

      client.on('connect', () => {
        client.disconnect();
        done.fail('Connection should have timed out');
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent connections', (done) => {
      const connections = [];
      const maxConnections = 10;
      let connectedCount = 0;

      for (let i = 0; i < maxConnections; i++) {
        const client = io.connect('http://localhost:3000', {
          auth: { token: `valid-token-${i}` },
        });

        client.on('connect', () => {
          connectedCount++;
          connections.push(client);

          if (connectedCount === maxConnections) {
            expect(connectedCount).toBe(maxConnections);
            
            // Clean up connections
            connections.forEach(client => client.disconnect());
            done();
          }
        });

        client.on('connect_error', (error) => {
          done.fail(`Connection ${i} failed: ${error.message}`);
        });
      }
    });

    it('should handle room switching efficiently', (done) => {
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'Test User',
      };

      const mockConversation1 = {
        id: 'conv1',
        type: 'direct',
        members: ['user123', 'user456'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      const mockConversation2 = {
        id: 'conv2',
        type: 'direct',
        members: ['user123', 'user789'],
        memberCount: 2,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      // Mock Firebase Auth verification
      const mockVerifyIdToken = jest.fn().mockResolvedValue(mockUser);

      // Mock conversation checks
      mockDb.collection().doc().get
        .mockResolvedValueOnce({
          exists: true,
          data: () => mockConversation1,
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => mockConversation2,
        });

      const client = io.connect('http://localhost:3000', {
        auth: { token: 'valid-token' },
      });

      let roomSwitchCount = 0;

      client.on('connect', () => {
        // Join first conversation
        client.emit('join_conversation', { conversationId: 'conv1' });

        client.on('joined_conversation', (data) => {
          if (data.conversationId === 'conv1') {
            // Switch to second conversation
            client.emit('join_conversation', { conversationId: 'conv2' });
          } else if (data.conversationId === 'conv2') {
            roomSwitchCount++;
            if (roomSwitchCount === 2) {
              expect(roomSwitchCount).toBe(2);
              client.disconnect();
              done();
            }
          }
        });
      });
    });
  });
});
