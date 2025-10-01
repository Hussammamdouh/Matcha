const { getFirestore } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../../lib/logger');
const { isParticipant, isModerator, isOwner, isBlocked } = require('../../../lib/chat/permissions');
const { buildConversationSummary, buildParticipantSummary } = require('../../../lib/chat/preview');
const { getProvider } = require('../../../lib/storageProvider');
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
      const [a, b] = memberUserIds;
      const keyA = String(a);
      const keyB = String(b);
      const pairKey = keyA < keyB ? `${keyA}_${keyB}` : `${keyB}_${keyA}`;

      // 1) Check deterministic pair mapping
      try {
        const pairDoc = await db.collection('direct_pairs').doc(pairKey).get();
        if (pairDoc.exists) {
          const existingId = pairDoc.data()?.conversationId;
          if (existingId) {
            const existingConvo = await getConversation(existingId, createdBy).catch(() => null);
            if (existingConvo) {
              logger.info('Direct conversation mapping found, returning existing', { conversationId: existingId, users: memberUserIds });
              return existingConvo;
            }
          }
        }
      } catch (_) {}

      // 2) Fallback: scan recent conversations, filter type in-memory, and check membership
      try {
        const recent = await db
          .collection('conversations')
          .orderBy('lastMessageAt', 'desc')
          .limit(200)
          .get();
        for (const doc of recent.docs) {
          const data = doc.data();
          if (data?.type !== 'direct') continue;
          const id = doc.id;
          try {
            const [pa, pb] = await Promise.all([
              db.collection('conversations').doc(id).collection('participants').doc(a).get(),
              db.collection('conversations').doc(id).collection('participants').doc(b).get(),
            ]);
            if (pa.exists && pb.exists) {
              logger.info('Direct conversation already exists (scanned), returning existing', { conversationId: id, users: memberUserIds });
              return await getConversation(id, createdBy);
            }
          } catch (_) {}
        }
      } catch (_) {}
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

    // If direct: persist deterministic mapping for future deduplication
    if (type === 'direct') {
      try {
        const [a, b] = memberUserIds;
        const keyA = String(a);
        const keyB = String(b);
        const pairKey = keyA < keyB ? `${keyA}_${keyB}` : `${keyB}_${keyA}`;
        await db.collection('direct_pairs').doc(pairKey).set({ conversationId, createdAt: new Date() }, { merge: true });
      } catch (_) {}
    }

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
    // Index-safe membership check
    const participantDoc = await db
      .collection('conversations')
      .doc(conversationId)
      .collection('participants')
      .doc(userId)
      .get();
    if (!participantDoc.exists || participantDoc.data()?.isBanned) {
      throw new Error('User is not a participant in this conversation');
    }

    // Get conversation data
    const conversationDoc = await db.collection('conversations').doc(conversationId).get();
    if (!conversationDoc.exists) {
      throw new Error('Conversation not found');
    }

    const conversation = { id: conversationId, ...conversationDoc.data() };

    // Get all participants
    const participantsSnapshot = await db
      .collection('conversations')
      .doc(conversationId)
      .collection('participants')
      .get();

    const participants = [];
    const userDetails = [];
    for (const doc of participantsSnapshot.docs) {
      const pdata = doc.data();
      participants.push(pdata);
      try {
        const userDoc = await db.collection('users').doc(pdata.userId).get();
        userDetails.push(userDoc.exists ? userDoc.data() : null);
      } catch (e) {
        userDetails.push(null);
      }
    }

    const participantSummaries = participants.map((p, i) => buildParticipantSummary(p, userDetails[i]));

    // Avoid composite index for last message
    let lastMessage = null;
    try {
      const snap = await db
        .collection('messages')
        .where('conversationId', '==', conversationId)
        .limit(50)
        .get();
      const msgs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => !m.isDeleted)
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return tb - ta;
        });
      if (msgs.length > 0) lastMessage = msgs[0];
    } catch (_) {}

    return buildConversationSummary(conversation, lastMessage, participantSummaries);
  } catch (error) {
    logger.error('Failed to get conversation', { error: error.message, conversationId, userId });
    // Resilient: return minimal conversation if doc exists but other steps fail
    try {
      const doc = await db.collection('conversations').doc(conversationId).get();
      if (doc.exists) return { id: doc.id, ...doc.data() };
    } catch (_) {}
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
    // Index-safe approach: scan recent conversations and check membership per conversation
    let convosSnap = await db
      .collection('conversations')
      .orderBy('lastMessageAt', 'desc')
      .limit(200)
      .get();

    if (convosSnap.empty) {
      return { conversations: [], meta: { hasMore: false, nextCursor: null } };
    }

    const allConversations = [];
    const participantMap = new Map();
    for (const doc of convosSnap.docs) {
      const convoId = doc.id;
      try {
        const participantDoc = await db
          .collection('conversations')
          .doc(convoId)
          .collection('participants')
          .doc(userId)
          .get();
        if (participantDoc.exists && !participantDoc.data()?.isBanned) {
          participantMap.set(convoId, participantDoc.data());
          allConversations.push({ id: convoId, ...doc.data() });
        }
      } catch (e) {
        logger.warn('Membership check failed for conversation', { conversationId: convoId, error: e.message });
      }
    }

    if (allConversations.length === 0) {
      return { conversations: [], meta: { hasMore: false, nextCursor: null } };
    }

    // Already ordered by lastMessageAt desc

    // Cursor-based pagination by id
    let startIndex = 0;
    if (cursor) {
      const decoded = decodeCursor(cursor);
      const cursorId = decoded?.id || decoded;
      const idx = allConversations.findIndex(c => c.id === cursorId);
      startIndex = idx >= 0 ? idx + 1 : 0;
    }

    const pageItems = allConversations.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < allConversations.length;

    const conversations = [];
    for (const convo of pageItems) {
      try {
        const convoId = convo.id;
        // Ensure we have participant info for current user
        if (!participantMap.has(convoId)) {
          continue;
        }

        // Load all participants then filter out current user to avoid '!=' index
        const participantsSnapshotAll = await db
          .collection('conversations')
          .doc(convoId)
          .collection('participants')
          .get();

        const otherParticipants = [];
        const userDetails = [];
        for (const pDoc of participantsSnapshotAll.docs) {
          const pData = pDoc.data();
          if (pData.userId === userId) continue;
          otherParticipants.push(pData);
          try {
            const userDoc = await db.collection('users').doc(pData.userId).get();
            userDetails.push(userDoc.exists ? userDoc.data() : null);
          } catch (error) {
            logger.warn('Failed to fetch user details', { userId: pData.userId, error: error.message });
            userDetails.push(null);
          }
        }

        const participantSummaries = otherParticipants.map((p, index) => buildParticipantSummary(p, userDetails[index]));

        const lastMessage = convo.lastMessagePreview
          ? { id: null, text: convo.lastMessagePreview, createdAt: convo.lastMessageAt || null }
          : null;

        const summary = buildConversationSummary(convo, lastMessage, participantSummaries);
        conversations.push(summary);
      } catch (e) {
        logger.warn('Failed to summarize conversation, skipping', { conversationId: convo.id, error: e.message });
      }
    }

    const nextCursor = hasMore && pageItems.length > 0 ? encodeCursor({ id: pageItems[pageItems.length - 1].id }) : null;

    return { conversations, meta: { hasMore, nextCursor } };
  } catch (error) {
    logger.error('Failed to list conversations', {
      error: error.message,
      userId,
      options,
    });
    // Be resilient: return empty list instead of propagating error
    return { conversations: [], meta: { hasMore: false, nextCursor: null } };
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
 * Delete a conversation and cascade delete messages, reactions, media, and participants
 * - Owner can delete; platform admins can delete any
 * @param {string} conversationId
 * @param {string} userId
 */
async function deleteConversation(conversationId, userId) {
  db = db || getFirestore();
  try {
    // Load conversation
    const convRef = db.collection('conversations').doc(conversationId);
    const convDoc = await convRef.get();
    if (!convDoc.exists) throw new Error('Conversation not found');
    const conversation = convDoc.data();

    // Permission: owner or admin
    let isAdmin = false;
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      const role = userDoc.exists ? (userDoc.data().role || userDoc.data().adminRole) : null;
      isAdmin = role === 'admin' || role === 'super_admin';
    } catch (_) {}

    // Identify owner
    let ownerId = null;
    try {
      const ownerSnap = await db
        .collection('conversations')
        .doc(conversationId)
        .collection('participants')
        .where('role', '==', 'owner')
        .limit(1)
        .get();
      if (!ownerSnap.empty) ownerId = ownerSnap.docs[0].id || ownerSnap.docs[0].data().userId;
    } catch (_) {}

    const isOwner = !!ownerId && (ownerId === userId);
    if (!isOwner && !isAdmin) {
      throw new Error('Insufficient permissions to delete conversation');
    }

    // Delete messages (soft-deleted already allowed) and their media and reactions
    try {
      const provider = getProvider();
      const messagesSnap = await db
        .collection('messages')
        .where('conversationId', '==', conversationId)
        .get();

      function extractObjectPathFromUrl(url) {
        try {
          if (!url || typeof url !== 'string') return null;
          if (url.includes('res.cloudinary.com')) {
            const idx = url.indexOf('/upload/');
            if (idx !== -1) {
              const after = url.substring(idx + '/upload/'.length);
              const parts = after.split('/');
              const maybeVersion = parts[0];
              const startIndex = /^v\d+$/.test(maybeVersion) ? 1 : 0;
              const pathParts = parts.slice(startIndex);
              const last = pathParts.pop() || '';
              const withoutExt = last.includes('.') ? last.substring(0, last.lastIndexOf('.')) : last;
              const publicId = [...pathParts, withoutExt].join('/');
              return publicId || null;
            }
          }
          if (url.includes('storage.googleapis.com')) {
            const u = new URL(url);
            const segments = u.pathname.split('/').filter(Boolean);
            if (segments.length >= 2) return decodeURIComponent(segments.slice(1).join('/'));
          }
          if (url.startsWith('gs://')) {
            const pathStart = url.indexOf('/', 'gs://'.length);
            if (pathStart > 0) return url.substring(pathStart + 1);
          }
          return null;
        } catch (_) { return null; }
      }

      for (const msgDoc of messagesSnap.docs) {
        const m = { id: msgDoc.id, ...msgDoc.data() };
        // Delete reactions subcollection
        try {
          const reactions = await db
            .collection('messages')
            .doc(m.id)
            .collection('reactions')
            .get();
          if (!reactions.empty) {
            const batch = db.batch();
            reactions.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        } catch (_) {}

        // Delete media file if present
        try {
          const objectPath = m.media?.objectPath || extractObjectPathFromUrl(m.media?.url);
          if (objectPath) await provider.deleteFile(objectPath).catch(() => {});
        } catch (_) {}

        // Delete message document entirely
        try { await msgDoc.ref.delete(); } catch (_) {}
      }
    } catch (e) {
      logger.warn('Failed to fully cascade delete messages (continuing)', { conversationId, error: e.message });
    }

    // Remove participants subcollection
    try {
      const partsSnap = await db
        .collection('conversations')
        .doc(conversationId)
        .collection('participants')
        .get();
      if (!partsSnap.empty) {
        const batch = db.batch();
        partsSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e) {
      logger.warn('Failed to delete conversation participants (continuing)', { conversationId, error: e.message });
    }

    // Delete conversation icon if set
    try {
      if (conversation.icon) {
        const provider = getProvider();
        const iconPath = conversation.icon && typeof conversation.icon === 'string' ? conversation.icon : null;
        if (iconPath) {
          // Try both direct path and extraction from URL
          let objectPath = iconPath;
          if (iconPath.startsWith('http')) {
            objectPath = (function (url) {
              try {
                if (url.includes('res.cloudinary.com')) {
                  const idx = url.indexOf('/upload/');
                  if (idx !== -1) {
                    const after = url.substring(idx + '/upload/'.length);
                    const parts = after.split('/');
                    const maybeVersion = parts[0];
                    const startIndex = /^v\d+$/.test(maybeVersion) ? 1 : 0;
                    const pathParts = parts.slice(startIndex);
                    const last = pathParts.pop() || '';
                    const withoutExt = last.includes('.') ? last.substring(0, last.lastIndexOf('.')) : last;
                    return [...pathParts, withoutExt].join('/');
                  }
                }
                if (url.includes('storage.googleapis.com')) {
                  const u = new URL(url);
                  const segments = u.pathname.split('/').filter(Boolean);
                  if (segments.length >= 2) return decodeURIComponent(segments.slice(1).join('/'));
                }
                if (url.startsWith('gs://')) {
                  const pathStart = url.indexOf('/', 'gs://'.length);
                  if (pathStart > 0) return url.substring(pathStart + 1);
                }
                return null;
              } catch (_) { return null; }
            })(iconPath);
          }
          if (objectPath) await provider.deleteFile(objectPath).catch(() => {});
        }
      }
    } catch (e) {
      logger.warn('Failed to delete conversation icon (continuing)', { conversationId, error: e.message });
    }

    // Finally, delete conversation document
    await convRef.delete();

    logger.info('Conversation deleted successfully', { conversationId, deletedBy: userId });
    return true;
  } catch (error) {
    logger.error('Failed to delete conversation', { error: error.message, conversationId, userId });
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
  deleteConversation,
};
