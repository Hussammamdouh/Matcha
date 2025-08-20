const { Server } = require('socket.io');
const { getAuth } = require('firebase-admin/auth');
const { createModuleLogger } = require('../../lib/logger');

const logger = createModuleLogger('chat:websocket');

class ChatWebSocketGateway {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify Firebase ID token
        const decodedToken = await getAuth().verifyIdToken(token);
        socket.userId = decodedToken.uid;
        socket.user = decodedToken;
        
        logger.info('User authenticated via WebSocket', { userId: socket.userId });
        next();
      } catch (error) {
        logger.error('WebSocket authentication failed', { error: error.message });
        next(new Error('Authentication failed'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('User connected to WebSocket', { userId: socket.userId });

      // Join user to their conversations
      socket.on('join_conversations', async (conversationIds) => {
        try {
          if (Array.isArray(conversationIds)) {
            conversationIds.forEach(conversationId => {
              socket.join(`conversation:${conversationId}`);
              logger.info('User joined conversation room', { 
                userId: socket.userId, 
                conversationId 
              });
            });
          }
        } catch (error) {
          logger.error('Failed to join conversations', { 
            userId: socket.userId, 
            error: error.message 
          });
        }
      });

      // Leave conversation room
      socket.on('leave_conversation', (conversationId) => {
        socket.leave(`conversation:${conversationId}`);
        logger.info('User left conversation room', { 
          userId: socket.userId, 
          conversationId 
        });
      });

      // Typing indicator
      socket.on('typing_start', (conversationId) => {
        socket.to(`conversation:${conversationId}`).emit('user_typing', {
          userId: socket.userId,
          conversationId,
          isTyping: true,
        });
      });

      socket.on('typing_stop', (conversationId) => {
        socket.to(`conversation:${conversationId}`).emit('user_typing', {
          userId: socket.userId,
          conversationId,
          isTyping: false,
        });
      });

      // Presence update
      socket.on('presence_update', (state) => {
        // Broadcast presence to all connected users
        socket.broadcast.emit('user_presence', {
          userId: socket.userId,
          state,
          timestamp: new Date(),
        });
      });

      // Message acknowledgment
      socket.on('message_ack', (messageId) => {
        // This could be used to track message delivery status
        logger.info('Message acknowledged', { 
          userId: socket.userId, 
          messageId 
        });
      });

      // Disconnect handling
      socket.on('disconnect', () => {
        logger.info('User disconnected from WebSocket', { userId: socket.userId });
        
        // Broadcast offline status
        socket.broadcast.emit('user_presence', {
          userId: socket.userId,
          state: 'offline',
          timestamp: new Date(),
        });
      });
    });
  }

  // Method to broadcast message to conversation participants
  broadcastMessage(conversationId, message) {
    this.io.to(`conversation:${conversationId}`).emit('new_message', {
      conversationId,
      message,
      timestamp: new Date(),
    });
    
    logger.info('Message broadcasted to conversation', { 
      conversationId, 
      messageId: message.id 
    });
  }

  // Method to broadcast typing indicator
  broadcastTyping(conversationId, userId, isTyping) {
    this.io.to(`conversation:${conversationId}`).emit('user_typing', {
      userId,
      conversationId,
      isTyping,
      timestamp: new Date(),
    });
  }

  // Method to broadcast presence update
  broadcastPresence(userId, state) {
    this.io.emit('user_presence', {
      userId,
      state,
      timestamp: new Date(),
    });
  }

  // Method to broadcast conversation updates
  broadcastConversationUpdate(conversationId, update) {
    this.io.to(`conversation:${conversationId}`).emit('conversation_updated', {
      conversationId,
      update,
      timestamp: new Date(),
    });
  }

  // Method to broadcast user banned/removed from conversation
  broadcastUserRemoved(conversationId, userId, reason) {
    this.io.to(`conversation:${conversationId}`).emit('user_removed', {
      conversationId,
      userId,
      reason,
      timestamp: new Date(),
    });
  }

  // Method to broadcast conversation locked/unlocked
  broadcastConversationLocked(conversationId, isLocked, moderatorId) {
    this.io.to(`conversation:${conversationId}`).emit('conversation_locked', {
      conversationId,
      isLocked,
      moderatorId,
      timestamp: new Date(),
    });
  }

  // Get connected users count for a conversation
  getConversationUserCount(conversationId) {
    const room = this.io.sockets.adapter.rooms.get(`conversation:${conversationId}`);
    return room ? room.size : 0;
  }

  // Get all connected users
  getConnectedUsers() {
    const users = [];
    this.io.sockets.sockets.forEach((socket) => {
      if (socket.userId) {
        users.push({
          userId: socket.userId,
          connectedAt: socket.connectedAt,
        });
      }
    });
    return users;
  }

  // Disconnect a specific user
  disconnectUser(userId) {
    this.io.sockets.sockets.forEach((socket) => {
      if (socket.userId === userId) {
        socket.disconnect(true);
        logger.info('User forcefully disconnected', { userId });
      }
    });
  }
}

module.exports = ChatWebSocketGateway;
