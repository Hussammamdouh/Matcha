const { getFirestore } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../../lib/logger');
const { isParticipant, isModerator, isOwner, isBlocked } = require('../../../lib/chat/permissions');
const { buildConversationSummary, buildParticipantSummary } = require('../../../lib/chat/preview');
const { encodeCursor, decodeCursor } = require('../../../lib/pagination');

let db;
const logger = createModuleLogger();

/**
 * Create a new conversation
 * @param {Object} data - Conversation data
 * @param {string} data.type - 'direct' or 'group'
 * @param {string} data.createdBy - User ID of creator
 * @param {string} data.title - Group title (required for groups)
 * @param {string} data.icon - Group icon (optional)
 * @param {Array} data.memberUserIds - Array of user IDs to add
 * @returns {Promise<Object>} Created conversation
 */
async function createConversation(data) {
  db = db || getFirestore();
  const { type, createdBy, title, icon, memberUserIds } = data;
  
  try {
    // Validate required fields
    if (!type || !createdBy || !memberUserIds || !Array.isArray(memberUserIds)) {
      throw new Error('Missing required fields');
    }

    if (type === 'group' && !title) {
      throw new Error('Group conversations require a title');
    }

    if (type === 'direct' && memberUserIds.length !== 2) {
      throw new Error('Direct conversations must have exactly 2 members');
    }

    if (type === 'group' && memberUserIds.length < 2) {
      throw new Error('Group conversations must have at least 2 members');
    }

    // Check for direct conversation deduplication
    if (type === 'direct') {
      const existingConversation = await findDirectConversation(memberUserIds[0], memberUserIds[1]);
      if (existingConversation) {
        logger.info('Direct conversation already exists, returning existing', {
          conversationId: existingConversation.id,
          users: memberUserIds,
        });
        return existingConversation;
      }
    }

    // Create conversation document
    const conversationData = {
      type,
      createdAt: new Date(),
      createdBy,
      memberCount: memberUserIds.length,
      lastMessageAt: new Date(),
      lastMessagePreview: '',
      isLocked: false,
    };

    if (type === 'group') {
      conversationData.title = title;
      if (icon) conversationData.icon = icon;
    }

    const conversationRef = await db.collection('conversations').add(conversationData);
    const conversationId = conversationRef.id;

    // Add participants in a batch
    const batch = db.batch();
    const participants = [];

    for (let i = 0; i < memberUserIds.length; i++) {
      const userId = memberUserIds[i];
      const role = i === 0 ? 'owner' : 'member';
      
      const participantData = {
        userId,
        role,
        joinedAt: new Date(),
        lastReadAt: new Date(),
        isTyping: false,
        isBanned: false,
      };

      const participantRef = db
        .collection('conversations')
        .doc(conversationId)
        .collection('participants')
        .doc(userId);

      batch.set(participantRef, participantData);
      participants.push({ ...participantData, userId });
    }

    await batch.commit();

    // Get user details for participants
    const userDetails = await Promise.all(
      memberUserIds.map(async (userId) => {
        try {
          const userDoc = await db.collection('users').doc(userId).get();
          return userDoc.exists ? userDoc.data() : null;
        } catch (error) {
          logger.warn('Failed to fetch user details', { userId, error: error.message });
          return null;
        }
      })
    );

    const conversation = {
      id: conversationId,
      ...conversationData,
    };

    const participantSummaries = participants.map((p, index) => 
      buildParticipantSummary(p, userDetails[index])
    );

    const summary = buildConversationSummary(conversation, null, participantSummaries);

    logger.info('Conversation created successfully', {
      conversationId,
      type,
      memberCount: memberUserIds.length,
      createdBy,
    });

    return summary;
  } catch (error) {
    logger.error('Failed to create conversation', {
      error: error.message,
      data,
    });
    throw error;
  }
}

/**
 * Find existing direct conversation between two users
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Promise<Object|null>} Existing conversation or null
 */
async function findDirectConversation(userId1, userId2) {
  db = db || getFirestore();
  try {
    // Query for conversations where both users are participants
    const participant1Query = db
      .collectionGroup('participants')
      .where('userId', '==', userId1)
      .where('role', 'in', ['member', 'owner']);

    const participant1Docs = await participant1Query.get();
    
    for (const doc of participant1Docs.docs) {
      const conversationId = doc.ref.parent.parent.id;
      
      // Check if the other user is also a participant
      const participant2Doc = await db
        .collection('conversations')
        .doc(conversationId)
        .collection('participants')
        .doc(userId2)
        .get();

      if (participant2Doc.exists) {
        // Verify this is a direct conversation
        const conversationDoc = await db.collection('conversations').doc(conversationId).get();
        if (conversationDoc.exists && conversationDoc.data().type === 'direct') {
          return await getConversation(conversationId, userId1);
        }
      }
    }

    return null;
  } catch (error) {
    logger.error('Error finding direct conversation', {
      error: error.message,
      userId1,
      userId2,
    });
    return null;
  }
}

/**
 * Get a conversation by ID
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID requesting the conversation
 * @returns {Promise<Object>} Conversation data
 */
async function getConversation(conversationId, userId) {
  db = db || getFirestore();
  try {
    // Check if user is a participant
    const participant = await isParticipant(userId, conversationId);
    if (!participant) {
      throw new Error('User is not a participant in this conversation');
    }

    // Get conversation data
    const conversationDoc = await db.collection('conversations').doc(conversationId).get();
    if (!conversationDoc.exists) {
      throw new Error('Conversation not found');
    }

    const conversation = {
      id: conversationId,
      ...conversationDoc.data(),
    };

    // Get all participants
    const participantsSnapshot = await db
      .collection('conversations')
      .doc(conversationId)
      .collection('participants')
      .get();

    const participants = [];
    const userDetails = [];

    for (const doc of participantsSnapshot.docs) {
      const participantData = doc.data();
      participants.push(participantData);
      
      // Get user details
      try {
        const userDoc = await db.collection('users').doc(participantData.userId).get();
        userDetails.push(userDoc.exists ? userDoc.data() : null);
      } catch (error) {
        logger.warn('Failed to fetch user details', { 
          userId: participantData.userId, 
          error: error.message 
        });
        userDetails.push(null);
      }
    }

    // Build participant summaries
    const participantSummaries = participants.map((p, index) => 
      buildParticipantSummary(p, userDetails[index])
    );

    // Get last message for preview
    const lastMessageSnapshot = await db
      .collection('messages')
      .where('conversationId', '==', conversationId)
      .where('isDeleted', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    const lastMessage = lastMessageSnapshot.empty ? null : {
      id: lastMessageSnapshot.docs[0].id,
      ...lastMessageSnapshot.docs[0].data(),
    };

    const summary = buildConversationSummary(conversation, lastMessage, participantSummaries);

    return summary;
  } catch (error) {
    logger.error('Failed to get conversation', {
      error: error.message,
      conversationId,
      userId,
    });
    throw error;
  }
}

/**
 * List user's conversations
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {string} options.cursor - Cursor for pagination
 * @param {number} options.pageSize - Number of conversations to return
 * @returns {Promise<Object>} Conversations list with pagination
 */
async function listConversations(userId, options = {}) {
  db = db || getFirestore();
  const { cursor, pageSize = 20 } = options;
  
  try {
    // Get user's participant documents
    const participantsQuery = db
      .collectionGroup('participants')
      .where('userId', '==', userId)
      .where('isBanned', '==', false);

    const participantsSnapshot = await participantsQuery.get();
    
    if (participantsSnapshot.empty) {
      return {
        conversations: [],
        meta: {
          hasMore: false,
          nextCursor: null,
        },
      };
    }

    // Get conversation IDs and participant data
    const conversationIds = [];
    const participantMap = new Map();

    for (const doc of participantsSnapshot.docs) {
      const conversationId = doc.ref.parent.parent.id;
      conversationIds.push(conversationId);
      participantMap.set(conversationId, doc.data());
    }

    // Get conversations ordered by lastMessageAt
    let conversationsQuery = db
      .collection('conversations')
      .where('__name__', 'in', conversationIds)
      .orderBy('lastMessageAt', 'desc');

    // Apply cursor if provided
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded?.id) {
        try {
          const docSnap = await db.collection('conversations').doc(decoded.id).get();
          if (docSnap.exists) {
            conversationsQuery = conversationsQuery.startAfter(docSnap);
          }
        } catch (_) {}
      }
    }

    // Apply page size
    conversationsQuery = conversationsQuery.limit(pageSize + 1);

    const conversationsSnapshot = await conversationsQuery.get();
    
    const conversations = [];
    let hasMore = false;

    for (let i = 0; i < conversationsSnapshot.docs.length; i++) {
      if (i >= pageSize) {
        hasMore = true;
        break;
      }

      const doc = conversationsSnapshot.docs[i];
      const conversation = {
        id: doc.id,
        ...doc.data(),
      };

      // Get participant data
      const participant = participantMap.get(doc.id);
      
      // Get other participants (excluding current user)
      const otherParticipantsSnapshot = await db
        .collection('conversations')
        .doc(doc.id)
        .collection('participants')
        .where('userId', '!=', userId)
        .get();

      const otherParticipants = [];
      const userDetails = [];

      for (const pDoc of otherParticipantsSnapshot.docs) {
        const pData = pDoc.data();
        otherParticipants.push(pData);
        
        // Get user details
        try {
          const userDoc = await db.collection('users').doc(pData.userId).get();
          userDetails.push(userDoc.exists ? userDoc.data() : null);
        } catch (error) {
          logger.warn('Failed to fetch user details', { 
            userId: pData.userId, 
            error: error.message 
          });
          userDetails.push(null);
        }
      }

      // Build participant summaries
      const participantSummaries = otherParticipants.map((p, index) => 
        buildParticipantSummary(p, userDetails[index])
      );

      // Get last message for preview
      const lastMessageSnapshot = await db
        .collection('messages')
        .where('conversationId', '==', doc.id)
        .where('isDeleted', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      const lastMessage = lastMessageSnapshot.empty ? null : {
        id: lastMessageSnapshot.docs[0].id,
        ...lastMessageSnapshot.docs[0].data(),
      };

      const summary = buildConversationSummary(conversation, lastMessage, participantSummaries);
      conversations.push(summary);
    }

    // Generate next cursor
    let nextCursor = null;
    if (hasMore && conversations.length > 0) {
      const lastDoc = conversationsSnapshot.docs[Math.min(conversationsSnapshot.docs.length - 1, pageSize - 1)];
      nextCursor = encodeCursor({ id: lastDoc.id, createdAt: lastDoc.get('lastMessageAt') });
    }

    return {
      conversations,
      meta: {
        hasMore,
        nextCursor,
      },
    };
  } catch (error) {
    logger.error('Failed to list conversations', {
      error: error.message,
      userId,
      options,
    });
    throw error;
  }
}

/**
 * Join a conversation (for invite-only groups)
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID joining
 * @returns {Promise<Object>} Updated conversation
 */
async function joinConversation(conversationId, userId) {
  db = db || getFirestore();
  try {
    // Check if conversation exists
    const conversationDoc = await db.collection('conversations').doc(conversationId).get();
    if (!conversationDoc.exists) {
      throw new Error('Conversation not found');
    }

    const conversation = conversationDoc.data();
    
    // Check if user is already a participant
    const existingParticipant = await isParticipant(userId, conversationId);
    if (existingParticipant) {
      throw new Error('User is already a participant in this conversation');
    }

    // Add user as participant
    const participantData = {
      userId,
      role: 'member',
      joinedAt: new Date(),
      lastReadAt: new Date(),
      isTyping: false,
      isBanned: false,
    };

    await db
      .collection('conversations')
      .doc(conversationId)
      .collection('participants')
      .doc(userId)
      .set(participantData);

    // Update member count
    await db.collection('conversations').doc(conversationId).update({
      memberCount: conversation.memberCount + 1,
    });

    logger.info('User joined conversation', {
      conversationId,
      userId,
      role: 'member',
    });

    return await getConversation(conversationId, userId);
  } catch (error) {
    logger.error('Failed to join conversation', {
      error: error.message,
      conversationId,
      userId,
    });
    throw error;
  }
}

/**
 * Leave a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID leaving
 * @returns {Promise<boolean>} Success status
 */
async function leaveConversation(conversationId, userId) {
  db = db || getFirestore();
  try {
    // Check if user is a participant
    const participant = await isParticipant(userId, conversationId);
    if (!participant) {
      throw new Error('User is not a participant in this conversation');
    }

    // Check if user is the owner
    if (participant.role === 'owner') {
      throw new Error('Owner cannot leave the conversation. Transfer ownership first.');
    }

    // Remove user from participants
    await db
      .collection('conversations')
      .doc(conversationId)
      .collection('participants')
      .doc(userId)
      .delete();

    // Update member count
    const conversationRef = db.collection('conversations').doc(conversationId);
    await conversationRef.update({
      memberCount: db.FieldValue.increment(-1),
    });

    logger.info('User left conversation', {
      conversationId,
      userId,
      role: participant.role,
    });

    return true;
  } catch (error) {
    logger.error('Failed to leave conversation', {
      error: error.message,
      conversationId,
      userId,
    });
    throw error;
  }
}

/**
 * Update conversation (title, icon, lock status)
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID making the update
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated conversation
 */
async function updateConversation(conversationId, userId, updates) {
  db = db || getFirestore();
  try {
    // Check if user is moderator or owner
    const isMod = await isModerator(userId, conversationId);
    if (!isMod) {
      throw new Error('Only moderators and owners can update conversations');
    }

    // Validate updates
    const allowedUpdates = {};
    if (updates.title !== undefined) {
      if (typeof updates.title !== 'string' || updates.title.length > 80) {
        throw new Error('Title must be a string with maximum 80 characters');
      }
      allowedUpdates.title = updates.title;
    }

    if (updates.icon !== undefined) {
      if (typeof updates.icon !== 'string') {
        throw new Error('Icon must be a string');
      }
      allowedUpdates.icon = updates.icon;
    }

    if (updates.isLocked !== undefined) {
      if (typeof updates.isLocked !== 'boolean') {
        throw new Error('isLocked must be a boolean');
      }
      allowedUpdates.isLocked = updates.isLocked;
    }

    if (Object.keys(allowedUpdates).length === 0) {
      throw new Error('No valid updates provided');
    }

    // Update conversation
    await db.collection('conversations').doc(conversationId).update(allowedUpdates);

    logger.info('Conversation updated', {
      conversationId,
      userId,
      updates: allowedUpdates,
    });

    return await getConversation(conversationId, userId);
  } catch (error) {
    logger.error('Failed to update conversation', {
      error: error.message,
      conversationId,
      userId,
      updates,
    });
    throw error;
  }
}

/**
 * Mute/unmute a conversation for a user
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @param {boolean} isMuted - Mute status
 * @returns {Promise<boolean>} Success status
 */
async function toggleMute(conversationId, userId, isMuted) {
  db = db || getFirestore();
  try {
    // Check if user is a participant
    const participant = await isParticipant(userId, conversationId);
    if (!participant) {
      throw new Error('User is not a participant in this conversation');
    }

    // Update mute status
    await db
      .collection('conversations')
      .doc(conversationId)
      .collection('participants')
      .doc(userId)
      .update({
        isMuted: isMuted,
      });

    logger.info('Conversation mute status updated', {
      conversationId,
      userId,
      isMuted,
    });

    return true;
  } catch (error) {
    logger.error('Failed to toggle conversation mute', {
      error: error.message,
      conversationId,
      userId,
      isMuted,
    });
    throw error;
  }
}

/**
 * Ban a user from a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} moderatorId - Moderator user ID
 * @param {string} targetUserId - User ID to ban
 * @returns {Promise<boolean>} Success status
 */
async function banUser(conversationId, moderatorId, targetUserId) {
  db = db || getFirestore();
  try {
    // Check if moderator has permission
    const isMod = await isModerator(moderatorId, conversationId);
    if (!isMod) {
      throw new Error('Only moderators can ban users');
    }

    // Check if target user is a participant
    const targetParticipant = await isParticipant(targetUserId, conversationId);
    if (!targetParticipant) {
      throw new Error('Target user is not a participant in this conversation');
    }

    // Check if target user is owner
    if (targetParticipant.role === 'owner') {
      throw new Error('Cannot ban the owner of the conversation');
    }

    // Ban the user
    await db
      .collection('conversations')
      .doc(conversationId)
      .collection('participants')
      .doc(targetUserId)
      .update({
        isBanned: true,
      });

    logger.info('User banned from conversation', {
      conversationId,
      moderatorId,
      targetUserId,
      role: targetParticipant.role,
    });

    return true;
  } catch (error) {
    logger.error('Failed to ban user from conversation', {
      error: error.message,
      conversationId,
      moderatorId,
      targetUserId,
    });
    throw error;
  }
}

module.exports = {
  createConversation,
  getConversation,
  listConversations,
  joinConversation,
  leaveConversation,
  updateConversation,
  toggleMute,
  banUser,
};
