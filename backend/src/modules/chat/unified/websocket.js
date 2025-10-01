const { Server } = require('socket.io');
const { getAuth } = require('firebase-admin/auth');
const { createModuleLogger } = require('../../../lib/logger');
const unifiedChatService = require('./service');

const logger = createModuleLogger('chat:unified:websocket');

class UnifiedChatWebSocket {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    
    // Connect to unified chat service
    unifiedChatService.setWebSocketGateway(this);
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || 
                     socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify Firebase ID token
        const decodedToken = await getAuth().verifyIdToken(token);
        socket.userId = decodedToken.uid;
        socket.user = decodedToken;
        socket.connectedAt = new Date();
        
        logger.info('User authenticated via WebSocket', { 
          userId: socket.userId,
          socketId: socket.id 
        });
        next();
      } catch (error) {
        logger.error('WebSocket authentication failed', { 
          error: error.message,
          socketId: socket.id 
        });
        next(new Error('Authentication failed'));
      }
    });

    // Connection middleware
    this.io.use(async (socket, next) => {
      try {
        // Handle user connection
        unifiedChatService.handleUserConnection(socket.userId, socket.id);
        next();
      } catch (error) {
        logger.error('Connection setup failed', { 
          error: error.message,
          userId: socket.userId 
        });
        next(error);
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('User connected to unified chat', { 
        userId: socket.userId, 
        socketId: socket.id 
      });

      // Join conversation
      socket.on('join_conversation', async (data) => {
        try {
          const { conversationId } = data;
          
          if (!conversationId) {
            socket.emit('error', { message: 'conversationId is required' });
            return;
          }

          // Verify user is participant
          const conversation = await unifiedChatService.getConversationWithMessages(
            conversationId, 
            socket.userId
          );

          if (conversation) {
            socket.join(`conversation:${conversationId}`);
            socket.emit('conversation_joined', { conversationId });
            
            // Send full conversation data
            socket.emit('conversation_data', conversation);
            
            logger.info('User joined conversation', { 
              userId: socket.userId, 
              conversationId 
            });
          } else {
            socket.emit('error', { message: 'Not authorized to join this conversation' });
          }
        } catch (error) {
          logger.error('Failed to join conversation', { 
            userId: socket.userId, 
            error: error.message 
          });
          socket.emit('error', { message: error.message });
        }
      });

      // Leave conversation
      socket.on('leave_conversation', (data) => {
        const { conversationId } = data;
        socket.leave(`conversation:${conversationId}`);
        socket.emit('conversation_left', { conversationId });
        
        logger.info('User left conversation', { 
          userId: socket.userId, 
          conversationId 
        });
      });

      // Send message
      socket.on('send_message', async (data) => {
        try {
          const { conversationId, type, text, media, replyTo } = data;
          
          if (!conversationId) {
            socket.emit('error', { message: 'conversationId is required' });
            return;
          }

          const message = await unifiedChatService.sendMessage(
            socket.userId, 
            conversationId, 
            { type, text, media, replyTo }
          );

          // Acknowledge message sent
          socket.emit('message_sent', { message });
          
          logger.info('Message sent via WebSocket', { 
            userId: socket.userId, 
            messageId: message.id,
            conversationId 
          });
        } catch (error) {
          logger.error('Failed to send message via WebSocket', { 
            userId: socket.userId, 
            error: error.message 
          });
          socket.emit('message_error', { message: error.message });
        }
      });

      // Typing indicators
      socket.on('typing_start', async (data) => {
        try {
          const { conversationId } = data;
          await unifiedChatService.updateTypingStatus(
            socket.userId, 
            conversationId, 
            true
          );
        } catch (error) {
          logger.error('Failed to start typing indicator', { 
            userId: socket.userId, 
            error: error.message 
          });
        }
      });

      socket.on('typing_stop', async (data) => {
        try {
          const { conversationId } = data;
          await unifiedChatService.updateTypingStatus(
            socket.userId, 
            conversationId, 
            false
          );
        } catch (error) {
          logger.error('Failed to stop typing indicator', { 
            userId: socket.userId, 
            error: error.message 
          });
        }
      });

      // Mark as read
      socket.on('mark_read', async (data) => {
        try {
          const { conversationId } = data;
          await unifiedChatService.markAsRead(socket.userId, conversationId);
          
          socket.emit('read_confirmed', { conversationId });
        } catch (error) {
          logger.error('Failed to mark as read', { 
            userId: socket.userId, 
            error: error.message 
          });
        }
      });

      // Edit message
      socket.on('edit_message', async (data) => {
        try {
          const { messageId, text } = data;
          await unifiedChatService.editMessage(socket.userId, messageId, text);
          
          socket.emit('message_edited', { messageId, text });
        } catch (error) {
          logger.error('Failed to edit message', { 
            userId: socket.userId, 
            error: error.message 
          });
          socket.emit('message_error', { message: error.message });
        }
      });

      // Delete message
      socket.on('delete_message', async (data) => {
        try {
          const { messageId } = data;
          await unifiedChatService.deleteMessage(socket.userId, messageId);
          
          socket.emit('message_deleted', { messageId });
        } catch (error) {
          logger.error('Failed to delete message', { 
            userId: socket.userId, 
            error: error.message 
          });
          socket.emit('message_error', { message: error.message });
        }
      });

      // Get conversations list
      socket.on('get_conversations', async (data) => {
        try {
          const { limit = 20, cursor = null } = data || {};
          const result = await unifiedChatService.getUserConversations(
            socket.userId, 
            { limit, cursor }
          );
          
          socket.emit('conversations_list', result);
        } catch (error) {
          logger.error('Failed to get conversations', { 
            userId: socket.userId, 
            error: error.message 
          });
          socket.emit('error', { message: error.message });
        }
      });

      // Get messages
      socket.on('get_messages', async (data) => {
        try {
          const { conversationId, limit = 50, cursor = null } = data;
          const result = await unifiedChatService.getMessages(
            conversationId, 
            socket.userId, 
            { limit, cursor }
          );
          
          socket.emit('messages_data', { 
            conversationId, 
            messages: result.messages,
            meta: result.meta 
          });
        } catch (error) {
          logger.error('Failed to get messages', { 
            userId: socket.userId, 
            error: error.message 
          });
          socket.emit('error', { message: error.message });
        }
      });

      // Presence updates
      socket.on('presence_update', (data) => {
        const { state } = data;
        unifiedChatService.updatePresence(socket.userId, state);
      });

      // Heartbeat
      socket.on('heartbeat', () => {
        socket.emit('heartbeat_ack', { timestamp: new Date() });
      });

      // Disconnect handling
      socket.on('disconnect', (reason) => {
        logger.info('User disconnected from unified chat', { 
          userId: socket.userId, 
          socketId: socket.id,
          reason 
        });
        
        // Handle disconnection
        unifiedChatService.handleUserDisconnection(socket.userId, socket.id);
      });

      // Error handling
      socket.on('error', (error) => {
        logger.error('Socket error', { 
          userId: socket.userId, 
          error: error.message 
        });
      });
    });
  }

  // Broadcast methods
  broadcastMessage(conversationId, message) {
    this.io.to(`conversation:${conversationId}`).emit('new_message', {
      conversationId,
      message,
      timestamp: new Date(),
    });
    
    logger.info('Message broadcasted', { 
      conversationId, 
      messageId: message.id 
    });
  }

  broadcastMessageUpdate(conversationId, update) {
    this.io.to(`conversation:${conversationId}`).emit('message_updated', {
      conversationId,
      update,
      timestamp: new Date(),
    });
    
    logger.info('Message update broadcasted', { 
      conversationId, 
      messageId: update.id 
    });
  }

  broadcastTyping(conversationId, userId, isTyping) {
    this.io.to(`conversation:${conversationId}`).emit('user_typing', {
      userId,
      conversationId,
      isTyping,
      timestamp: new Date(),
    });
  }

  broadcastPresence(userId, state) {
    this.io.emit('user_presence', {
      userId,
      state,
      timestamp: new Date(),
    });
  }

  broadcastConversationUpdate(conversationId, update) {
    this.io.to(`conversation:${conversationId}`).emit('conversation_updated', {
      conversationId,
      update,
      timestamp: new Date(),
    });
  }

  // Utility methods
  getConnectedUsers() {
    const users = [];
    this.io.sockets.sockets.forEach((socket) => {
      if (socket.userId) {
        users.push({
          userId: socket.userId,
          socketId: socket.id,
          connectedAt: socket.connectedAt,
        });
      }
    });
    return users;
  }

  getConversationUserCount(conversationId) {
    const room = this.io.sockets.adapter.rooms.get(`conversation:${conversationId}`);
    return room ? room.size : 0;
  }

  disconnectUser(userId) {
    this.io.sockets.sockets.forEach((socket) => {
      if (socket.userId === userId) {
        socket.disconnect(true);
        logger.info('User forcefully disconnected', { userId });
      }
    });
  }

  // Get socket instance for external use
  getSocketInstance() {
    return this.io;
  }
}

module.exports = UnifiedChatWebSocket;
