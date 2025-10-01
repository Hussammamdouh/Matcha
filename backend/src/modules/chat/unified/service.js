const { db } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../../lib/logger');
const { sanitizeChatText } = require('../../../lib/chat/sanitize');

const logger = createModuleLogger('chat:unified');

class UnifiedChatService {
  constructor() {
    this.activeConnections = new Map(); // userId -> Set of socketIds
    this.typingUsers = new Map(); // conversationId -> Set of userIds
    this.presenceCache = new Map(); // userId -> { state, lastSeen }
  }

  /**
   * Initialize WebSocket gateway
   */
  setWebSocketGateway(wsGateway) {
    this.wsGateway = wsGateway;
  }

  /**
   * Handle user connection
   */
  handleUserConnection(userId, socketId) {
    if (!this.activeConnections.has(userId)) {
      this.activeConnections.set(userId, new Set());
    }
    this.activeConnections.get(userId).add(socketId);
    
    // Update presence
    this.updatePresence(userId, 'online');
    
    logger.info('User connected to chat', { userId, socketId });
  }

  /**
   * Handle user disconnection
   */
  handleUserDisconnection(userId, socketId) {
    const userConnections = this.activeConnections.get(userId);
    if (userConnections) {
      userConnections.delete(socketId);
      
      // If no more connections, mark as offline
      if (userConnections.size === 0) {
        this.activeConnections.delete(userId);
        this.updatePresence(userId, 'offline');
      }
    }
    
    logger.info('User disconnected from chat', { userId, socketId });
  }

  /**
   * Update user presence
   */
  updatePresence(userId, state) {
    this.presenceCache.set(userId, {
      state,
      lastSeen: new Date(),
    });

    // Broadcast presence update
    if (this.wsGateway) {
      this.wsGateway.broadcastPresence(userId, state);
    }

    // Update in database
    db.collection('user_presence').doc(userId).set({
      state,
      lastSeen: new Date(),
      updatedAt: new Date(),
    }, { merge: true });
  }

  /**
   * Create or get conversation
   */
  async createOrGetConversation(userId, participantIds, type = 'direct', title = null) {
    try {
      // Validate participant IDs
      const allParticipants = [userId, ...participantIds].filter(Boolean);
      const uniqueParticipants = [...new Set(allParticipants)];
      
      if (uniqueParticipants.length < 2) {
        throw new Error('At least 2 participants required');
      }

      // For direct conversations, check if one already exists
      if (type === 'direct' && uniqueParticipants.length === 2) {
        const existingConv = await this.findExistingDirectConversation(uniqueParticipants);
        if (existingConv) {
          return await this.getConversationWithMessages(existingConv.id, userId);
        }
      }

      // Create new conversation
      const conversationRef = db.collection('conversations').doc();
      const conversationData = {
        id: conversationRef.id,
        type,
        title: type === 'group' ? title : null,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMessageAt: null,
        lastMessagePreview: null,
        isActive: true,
        metadata: {
          participantCount: uniqueParticipants.length,
        },
      };

      await db.runTransaction(async (transaction) => {
        // Create conversation
        transaction.set(conversationRef, conversationData);

        // Add participants
        for (const participantId of uniqueParticipants) {
          const participantRef = conversationRef.collection('participants').doc(participantId);
          transaction.set(participantRef, {
            userId: participantId,
            joinedAt: new Date(),
            lastReadAt: null,
            isMuted: false,
            role: participantId === userId ? 'admin' : 'member',
            isActive: true,
          });
        }
      });

      logger.info('Conversation created', { 
        conversationId: conversationRef.id, 
        type, 
        participantCount: uniqueParticipants.length 
      });

      return await this.getConversationWithMessages(conversationRef.id, userId);
    } catch (error) {
      logger.error('Failed to create conversation', { error: error.message });
      throw error;
    }
  }

  /**
   * Find existing direct conversation between two users
   */
  async findExistingDirectConversation(participantIds) {
    try {
      // Query conversations where both users are participants
      const [user1, user2] = participantIds;
      
      const snapshot = await db
        .collection('conversations')
        .where('type', '==', 'direct')
        .where('isActive', '==', true)
        .get();

      for (const doc of snapshot.docs) {
        const participantsSnapshot = await doc.ref
          .collection('participants')
          .where('userId', 'in', participantIds)
          .get();

        if (participantsSnapshot.size === 2) {
          return { id: doc.id, ...doc.data() };
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to find existing conversation', { error: error.message });
      return null;
    }
  }

  /**
   * Get conversation with full message history
   */
  async getConversationWithMessages(conversationId, userId, options = {}) {
    try {
      const { limit = 50, cursor = null } = options;

      // Get conversation
      const conversationDoc = await db.collection('conversations').doc(conversationId).get();
      if (!conversationDoc.exists) {
        throw new Error('Conversation not found');
      }

      const conversation = { id: conversationDoc.id, ...conversationDoc.data() };

      // Check if user is participant
      const participantDoc = await db
        .collection('conversations')
        .doc(conversationId)
        .collection('participants')
        .doc(userId)
        .get();

      if (!participantDoc.exists) {
        throw new Error('User is not a participant in this conversation');
      }

      // Get participants with user details
      const participantsSnapshot = await db
        .collection('conversations')
        .doc(conversationId)
        .collection('participants')
        .get();

      const participants = [];
      for (const participantDoc of participantsSnapshot.docs) {
        const participantData = participantDoc.data();
        
        // Get user details
        const userDoc = await db.collection('users').doc(participantData.userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};

        participants.push({
          ...participantData,
          user: {
            id: participantData.userId,
            nickname: userData.nickname || 'Unknown User',
            avatar: userData.avatar || null,
            isOnline: this.activeConnections.has(participantData.userId),
          },
        });
      }

      // Get messages with pagination
      const messages = await this.getMessages(conversationId, userId, { limit, cursor });

      return {
        ...conversation,
        participants,
        messages: messages.messages,
        messageMeta: messages.meta,
      };
    } catch (error) {
      logger.error('Failed to get conversation with messages', { error: error.message });
      throw error;
    }
  }

  /**
   * Get messages in a conversation
   */
  async getMessages(conversationId, userId, options = {}) {
    try {
      const { limit = 50, cursor = null, order = 'desc' } = options;

      // Check if user is participant
      const participantDoc = await db
        .collection('conversations')
        .doc(conversationId)
        .collection('participants')
        .doc(userId)
        .get();

      if (!participantDoc.exists) {
        throw new Error('User is not a participant in this conversation');
      }

      // Get messages
      let query = db
        .collection('messages')
        .where('conversationId', '==', conversationId)
        .where('isDeleted', '==', false)
        .orderBy('createdAt', order)
        .limit(limit + 1); // Get one extra to check if there are more

      if (cursor) {
        const cursorDoc = await db.collection('messages').doc(cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      const snapshot = await query.get();
      const messages = [];
      let hasMore = false;

      snapshot.docs.forEach((doc, index) => {
        if (index < limit) {
          messages.push({ id: doc.id, ...doc.data() });
        } else {
          hasMore = true;
        }
      });

      // If order is desc, reverse to show oldest first
      if (order === 'desc') {
        messages.reverse();
      }

      return {
        messages,
        meta: {
          hasMore,
          nextCursor: hasMore ? messages[messages.length - 1]?.id : null,
          total: messages.length,
        },
      };
    } catch (error) {
      logger.error('Failed to get messages', { error: error.message });
      throw error;
    }
  }

  /**
   * Send message
   */
  async sendMessage(userId, conversationId, messageData) {
    try {
      const { type = 'text', text = '', media = null, replyTo = null } = messageData;

      // Validate message
      if (type === 'text' && !text.trim()) {
        throw new Error('Text message cannot be empty');
      }

      if (type !== 'text' && !media) {
        throw new Error('Media message requires media data');
      }

      // Check if user is participant
      const participantDoc = await db
        .collection('conversations')
        .doc(conversationId)
        .collection('participants')
        .doc(userId)
        .get();

      if (!participantDoc.exists) {
        throw new Error('User is not a participant in this conversation');
      }

      // Sanitize text
      const sanitizedText = text ? sanitizeChatText(text) : '';

      const messageRef = db.collection('messages').doc();
      const message = {
        id: messageRef.id,
        conversationId,
        authorId: userId,
        type,
        text: sanitizedText,
        media,
        replyTo,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
        isEdited: false,
        reactions: {},
        metadata: {
          deliveryStatus: 'sent',
        },
      };

      await db.runTransaction(async (transaction) => {
        // Create message
        transaction.set(messageRef, message);

        // Update conversation
        const conversationRef = db.collection('conversations').doc(conversationId);
        transaction.update(conversationRef, {
          lastMessageAt: message.createdAt,
          lastMessagePreview: this.buildMessagePreview(sanitizedText, type),
          updatedAt: new Date(),
        });

        // Update author's last read
        const authorParticipantRef = conversationRef.collection('participants').doc(userId);
        transaction.update(authorParticipantRef, {
          lastReadAt: message.createdAt,
        });
      });

      // Broadcast message via WebSocket
      if (this.wsGateway) {
        this.wsGateway.broadcastMessage(conversationId, message);
      }

      logger.info('Message sent', { 
        messageId: message.id, 
        conversationId, 
        authorId: userId 
      });

      return message;
    } catch (error) {
      logger.error('Failed to send message', { error: error.message });
      throw error;
    }
  }

  /**
   * Update typing status
   */
  async updateTypingStatus(userId, conversationId, isTyping) {
    try {
      // Check if user is participant
      const participantDoc = await db
        .collection('conversations')
        .doc(conversationId)
        .collection('participants')
        .doc(userId)
        .get();

      if (!participantDoc.exists) {
        throw new Error('User is not a participant in this conversation');
      }

      // Update typing status in memory
      if (!this.typingUsers.has(conversationId)) {
        this.typingUsers.set(conversationId, new Set());
      }

      const typingSet = this.typingUsers.get(conversationId);
      if (isTyping) {
        typingSet.add(userId);
      } else {
        typingSet.delete(userId);
      }

      // Broadcast typing status
      if (this.wsGateway) {
        this.wsGateway.broadcastTyping(conversationId, userId, isTyping);
      }

      // Auto-clear typing status after 3 seconds
      if (isTyping) {
        setTimeout(() => {
          this.updateTypingStatus(userId, conversationId, false);
        }, 3000);
      }
    } catch (error) {
      logger.error('Failed to update typing status', { error: error.message });
    }
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(userId, conversationId) {
    try {
      const readAt = new Date();

      await db
        .collection('conversations')
        .doc(conversationId)
        .collection('participants')
        .doc(userId)
        .update({
          lastReadAt: readAt,
        });

      logger.info('Conversation marked as read', { userId, conversationId });
    } catch (error) {
      logger.error('Failed to mark as read', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user's conversations list
   */
  async getUserConversations(userId, options = {}) {
    try {
      const { limit = 20, cursor = null } = options;

      // Get user's conversations - avoid composite index by using a different approach
      // First get all conversations where user is a participant
      const allConversationsSnapshot = await db
        .collection('conversations')
        .where('isActive', '==', true)
        .limit(200) // Fetch recent conversations
        .get();

      // Filter conversations where user is a participant
      const userConversations = [];
      for (const convDoc of allConversationsSnapshot.docs) {
        const participantDoc = await convDoc.ref
          .collection('participants')
          .doc(userId)
          .get();
        
        if (participantDoc.exists && participantDoc.data().isActive !== false) {
          userConversations.push({
            convDoc,
            participantDoc,
            participantData: participantDoc.data()
          });
        }
      }

      const participantSnapshot = {
        docs: userConversations.map(item => ({
          ref: item.participantDoc.ref,
          data: () => item.participantData
        }))
      };

      const conversations = [];
      let hasMore = false;

      // Process all participants and sort by lastReadAt in memory
      const participantDataList = participantSnapshot.docs.map(doc => ({
        doc,
        data: doc.data()
      }));

      // Sort by lastReadAt desc in memory
      participantDataList.sort((a, b) => {
        const timeA = a.data.lastReadAt?.toMillis?.() || 0;
        const timeB = b.data.lastReadAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      for (let i = 0; i < participantDataList.length; i++) {
        if (i >= limit) {
          hasMore = true;
          break;
        }

        const { doc: participantDoc, data: participantData } = participantDataList[i];
        
        // Get conversation - already have it from the filtering step
        const conversationRef = participantDoc.ref.parent.parent;
        const conversationDoc = allConversationsSnapshot.docs.find(doc => doc.id === conversationRef.id);
        
        if (conversationDoc && conversationDoc.exists) {
          const conversationData = conversationDoc.data();
          
          // Get other participants for display
          const otherParticipantsSnapshot = await conversationRef
            .collection('participants')
            .where('userId', '!=', userId)
            .get();

          const otherParticipants = [];
          for (const otherDoc of otherParticipantsSnapshot.docs) {
            const otherData = otherDoc.data();
            const userDoc = await db.collection('users').doc(otherData.userId).get();
            const userData = userDoc.exists ? userDoc.data() : {};

            otherParticipants.push({
              ...otherData,
              user: {
                id: otherData.userId,
                nickname: userData.nickname || 'Unknown User',
                avatar: userData.avatar || null,
                isOnline: this.activeConnections.has(otherData.userId),
              },
            });
          }

          conversations.push({
            ...conversationData,
            participantData,
            otherParticipants,
            unreadCount: await this.getUnreadCount(conversationRef.id, userId),
          });
        }
      }

      // Sort by last message time
      conversations.sort((a, b) => {
        const timeA = a.lastMessageAt?.toMillis?.() || 0;
        const timeB = b.lastMessageAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      return {
        conversations,
        meta: {
          hasMore,
          total: conversations.length,
        },
      };
    } catch (error) {
      logger.error('Failed to get user conversations', { error: error.message });
      throw error;
    }
  }

  /**
   * Get unread message count for a conversation
   */
  async getUnreadCount(conversationId, userId) {
    try {
      const participantDoc = await db
        .collection('conversations')
        .doc(conversationId)
        .collection('participants')
        .doc(userId)
        .get();

      if (!participantDoc.exists) {
        return 0;
      }

      const participantData = participantDoc.data();
      const lastReadAt = participantData.lastReadAt;

      if (!lastReadAt) {
        // Count all messages if never read
        const messagesSnapshot = await db
          .collection('messages')
          .where('conversationId', '==', conversationId)
          .where('isDeleted', '==', false)
          .get();

        return messagesSnapshot.size;
      }

      // Count messages after last read
      const unreadSnapshot = await db
        .collection('messages')
        .where('conversationId', '==', conversationId)
        .where('isDeleted', '==', false)
        .where('createdAt', '>', lastReadAt)
        .where('authorId', '!=', userId) // Don't count own messages
        .get();

      return unreadSnapshot.size;
    } catch (error) {
      logger.error('Failed to get unread count', { error: error.message });
      return 0;
    }
  }

  /**
   * Get typing users for a conversation
   */
  getTypingUsers(conversationId) {
    const typingSet = this.typingUsers.get(conversationId);
    return typingSet ? Array.from(typingSet) : [];
  }

  /**
   * Build message preview
   */
  buildMessagePreview(text, type) {
    if (type === 'text') {
      return text.length > 50 ? text.substring(0, 50) + '...' : text;
    } else if (type === 'image') {
      return '📷 Photo';
    } else if (type === 'audio') {
      return '🎵 Audio';
    } else if (type === 'video') {
      return '🎥 Video';
    }
    return 'Message';
  }

  /**
   * Delete message
   */
  async deleteMessage(userId, messageId) {
    try {
      const messageDoc = await db.collection('messages').doc(messageId).get();
      
      if (!messageDoc.exists) {
        throw new Error('Message not found');
      }

      const messageData = messageDoc.data();

      // Check permissions
      if (messageData.authorId !== userId) {
        throw new Error('Can only delete your own messages');
      }

      // Soft delete
      await db.collection('messages').doc(messageId).update({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      });

      // Broadcast deletion
      if (this.wsGateway) {
        this.wsGateway.broadcastMessageUpdate(messageData.conversationId, {
          id: messageId,
          isDeleted: true,
          deletedAt: new Date(),
        });
      }

      logger.info('Message deleted', { messageId, userId });
    } catch (error) {
      logger.error('Failed to delete message', { error: error.message });
      throw error;
    }
  }

  /**
   * Edit message
   */
  async editMessage(userId, messageId, newText) {
    try {
      const messageDoc = await db.collection('messages').doc(messageId).get();
      
      if (!messageDoc.exists) {
        throw new Error('Message not found');
      }

      const messageData = messageDoc.data();

      // Check permissions
      if (messageData.authorId !== userId) {
        throw new Error('Can only edit your own messages');
      }

      // Check edit time limit (15 minutes)
      const editTimeLimit = 15 * 60 * 1000; // 15 minutes
      const messageTime = messageData.createdAt?.toMillis?.() || 0;
      const now = Date.now();
      
      if (now - messageTime > editTimeLimit) {
        throw new Error('Message cannot be edited after 15 minutes');
      }

      const sanitizedText = sanitizeChatText(newText);

      await db.collection('messages').doc(messageId).update({
        text: sanitizedText,
        isEdited: true,
        editedAt: new Date(),
        updatedAt: new Date(),
      });

      // Broadcast edit
      if (this.wsGateway) {
        this.wsGateway.broadcastMessageUpdate(messageData.conversationId, {
          id: messageId,
          text: sanitizedText,
          isEdited: true,
          editedAt: new Date(),
        });
      }

      logger.info('Message edited', { messageId, userId });
    } catch (error) {
      logger.error('Failed to edit message', { error: error.message });
      throw error;
    }
  }
}

module.exports = new UnifiedChatService();
