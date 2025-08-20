const { getFirestore } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');

// Remove top-level Firebase initialization
// const db = getFirestore();
const logger = createModuleLogger('admin:moderation:service');

/**
 * Get Firestore instance (lazy-loaded)
 * @returns {Object} Firestore instance
 */
function getDb() {
  return getFirestore();
}

/**
 * Remove a post (soft delete)
 * @param {string} postId - Post ID
 * @param {string} actorUserId - ID of the user removing the post
 * @param {string} reason - Reason for removal
 * @returns {Promise<Object>} Updated post
 */
async function removePost(postId, actorUserId, reason) {
  try {
    const db = getDb();
    const postRef = db.collection('posts').doc(postId);
    
    const result = await db.runTransaction(async (transaction) => {
      const postDoc = await transaction.get(postRef);
      
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }
      
      const postData = postDoc.data();
      
      if (postData.status === 'removed') {
        throw new Error('Post is already removed');
      }
      
      const updates = {
        status: 'removed',
        removedBy: actorUserId,
        removedAt: new Date(),
        removalReason: reason,
        updatedAt: new Date(),
      };
      
      transaction.update(postRef, updates);
      
      return {
        id: postId,
        ...postData,
        ...updates,
      };
    });
    
    logger.info('Post removed', {
      postId,
      actorUserId,
      reason,
    });

    return result;
  } catch (error) {
    logger.error('Failed to remove post', {
      error: error.message,
      postId,
      actorUserId,
      reason,
    });
    throw error;
  }
}

/**
 * Restore a removed post
 * @param {string} postId - Post ID
 * @param {string} actorUserId - ID of the user restoring the post
 * @returns {Promise<Object>} Updated post
 */
async function restorePost(postId, actorUserId) {
  try {
    const db = getDb();
    const postRef = db.collection('posts').doc(postId);
    
    const result = await db.runTransaction(async (transaction) => {
      const postDoc = await transaction.get(postRef);
      
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }
      
      const postData = postDoc.data();
      
      if (postData.status !== 'removed') {
        throw new Error('Post is not removed');
      }
      
      const updates = {
        status: 'active',
        removedBy: null,
        removedAt: null,
        removalReason: null,
        updatedAt: new Date(),
      };
      
      transaction.update(postRef, updates);
      
      return {
        id: postId,
        ...postData,
        ...updates,
      };
    });
    
    logger.info('Post restored', {
      postId,
      actorUserId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to restore post', {
      error: error.message,
      postId,
      actorUserId,
    });
    throw error;
  }
}

/**
 * Remove a comment (soft delete)
 * @param {string} commentId - Comment ID
 * @param {string} actorUserId - ID of the user removing the comment
 * @param {string} reason - Reason for removal
 * @returns {Promise<Object>} Updated comment
 */
async function removeComment(commentId, actorUserId, reason) {
  try {
    const db = getDb();
    const commentRef = db.collection('comments').doc(commentId);
    
    const result = await db.runTransaction(async (transaction) => {
      const commentDoc = await transaction.get(commentRef);
      
      if (!commentDoc.exists) {
        throw new Error('Comment not found');
      }
      
      const commentData = commentDoc.data();
      
      if (commentData.status === 'removed') {
        throw new Error('Comment is already removed');
      }
      
      const updates = {
        status: 'removed',
        removedBy: actorUserId,
        removedAt: new Date(),
        removalReason: reason,
        updatedAt: new Date(),
      };
      
      transaction.update(commentRef, updates);
      
      return {
        id: commentId,
        ...commentData,
        ...updates,
      };
    });
    
    logger.info('Comment removed', {
      commentId,
      actorUserId,
      reason,
    });

    return result;
  } catch (error) {
    logger.error('Failed to remove comment', {
      error: error.message,
      commentId,
      actorUserId,
      reason,
    });
    throw error;
  }
}

/**
 * Restore a removed comment
 * @param {string} commentId - Comment ID
 * @param {string} actorUserId - ID of the user restoring the comment
 * @returns {Promise<Object>} Updated comment
 */
async function restoreComment(commentId, actorUserId) {
  try {
    const db = getDb();
    const commentRef = db.collection('comments').doc(commentId);
    
    const result = await db.runTransaction(async (transaction) => {
      const commentDoc = await transaction.get(commentRef);
      
      if (!commentDoc.exists) {
        throw new Error('Comment not found');
      }
      
      const commentData = commentDoc.data();
      
      if (commentData.status !== 'removed') {
        throw new Error('Comment is not removed');
      }
      
      const updates = {
        status: 'active',
        removedBy: null,
        removedAt: null,
        removalReason: null,
        updatedAt: new Date(),
      };
      
      transaction.update(commentRef, updates);
      
      return {
        id: commentId,
        ...commentData,
        ...updates,
      };
    });
    
    logger.info('Comment restored', {
      commentId,
      actorUserId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to restore comment', {
      error: error.message,
      commentId,
      actorUserId,
    });
    throw error;
  }
}

/**
 * Lock a community (prevents new posts/comments)
 * @param {string} communityId - Community ID
 * @param {string} actorUserId - ID of the user locking the community
 * @param {string} reason - Reason for locking
 * @returns {Promise<Object>} Updated community
 */
async function lockCommunity(communityId, actorUserId, reason) {
  try {
    const db = getDb();
    const communityRef = db.collection('communities').doc(communityId);
    
    const result = await db.runTransaction(async (transaction) => {
      const communityDoc = await transaction.get(communityRef);
      
      if (!communityDoc.exists) {
        throw new Error('Community not found');
      }
      
      const communityData = communityDoc.data();
      
      if (communityData.isLocked) {
        throw new Error('Community is already locked');
      }
      
      const updates = {
        isLocked: true,
        lockedBy: actorUserId,
        lockedAt: new Date(),
        lockReason: reason,
        updatedAt: new Date(),
      };
      
      transaction.update(communityRef, updates);
      
      return {
        id: communityId,
        ...communityData,
        ...updates,
      };
    });
    
    logger.info('Community locked', {
      communityId,
      actorUserId,
      reason,
    });

    return result;
  } catch (error) {
    logger.error('Failed to lock community', {
      error: error.message,
      communityId,
      actorUserId,
      reason,
    });
    throw error;
  }
}

/**
 * Unlock a locked community
 * @param {string} communityId - Community ID
 * @param {string} actorUserId - ID of the user unlocking the community
 * @returns {Promise<Object>} Updated community
 */
async function unlockCommunity(communityId, actorUserId) {
  try {
    const db = getDb();
    const communityRef = db.collection('communities').doc(communityId);
    
    const result = await db.runTransaction(async (transaction) => {
      const communityDoc = await transaction.get(communityRef);
      
      if (!communityDoc.exists) {
        throw new Error('Community not found');
      }
      
      const communityData = communityDoc.data();
      
      if (!communityData.isLocked) {
        throw new Error('Community is not locked');
      }
      
      const updates = {
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
        lockReason: null,
        updatedAt: new Date(),
      };
      
      transaction.update(communityRef, updates);
      
      return {
        id: communityId,
        ...communityData,
        ...updates,
      };
    });
    
    logger.info('Community unlocked', {
      communityId,
      actorUserId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to unlock community', {
      error: error.message,
      communityId,
      actorUserId,
    });
    throw error;
  }
}

/**
 * Remove a chat message (soft delete)
 * @param {string} messageId - Message ID
 * @param {string} actorUserId - ID of the user removing the message
 * @param {string} reason - Reason for removal
 * @returns {Promise<Object>} Updated message
 */
async function removeChatMessage(messageId, actorUserId, reason) {
  try {
    const db = getDb();
    const messageRef = db.collection('messages').doc(messageId);
    
    const result = await db.runTransaction(async (transaction) => {
      const messageDoc = await transaction.get(messageRef);
      
      if (!messageDoc.exists) {
        throw new Error('Message not found');
      }
      
      const messageData = messageDoc.data();
      
      if (messageData.status === 'removed') {
        throw new Error('Message is already removed');
      }
      
      const updates = {
        status: 'removed',
        removedBy: actorUserId,
        removedAt: new Date(),
        removalReason: reason,
        updatedAt: new Date(),
      };
      
      transaction.update(messageRef, updates);
      
      return {
        id: messageId,
        ...messageData,
        ...updates,
      };
    });
    
    logger.info('Chat message removed', {
      messageId,
      actorUserId,
      reason,
    });

    return result;
  } catch (error) {
    logger.error('Failed to remove chat message', {
      error: error.message,
      messageId,
      actorUserId,
      reason,
    });
    throw error;
  }
}

/**
 * Restore a removed chat message
 * @param {string} messageId - Message ID
 * @param {string} actorUserId - ID of the user restoring the message
 * @returns {Promise<Object>} Updated message
 */
async function restoreChatMessage(messageId, actorUserId) {
  try {
    const db = getDb();
    const messageRef = db.collection('messages').doc(messageId);
    
    const result = await db.runTransaction(async (transaction) => {
      const messageDoc = await transaction.get(messageRef);
      
      if (!messageDoc.exists) {
        throw new Error('Message not found');
      }
      
      const messageData = messageDoc.data();
      
      if (messageData.status !== 'removed') {
        throw new Error('Message is not removed');
      }
      
      const updates = {
        status: 'active',
        removedBy: null,
        removedAt: null,
        removalReason: null,
        updatedAt: new Date(),
      };
      
      transaction.update(messageRef, updates);
      
      return {
        id: messageId,
        ...messageData,
        ...updates,
      };
    });
    
    logger.info('Chat message restored', {
      messageId,
      actorUserId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to restore chat message', {
      error: error.message,
      messageId,
      actorUserId,
    });
    throw error;
  }
}

/**
 * Lock a chat conversation (prevents new messages)
 * @param {string} conversationId - Conversation ID
 * @param {string} actorUserId - ID of the user locking the conversation
 * @param {string} reason - Reason for locking
 * @returns {Promise<Object>} Updated conversation
 */
async function lockChatConversation(conversationId, actorUserId, reason) {
  try {
    const db = getDb();
    const conversationRef = db.collection('conversations').doc(conversationId);
    
    const result = await db.runTransaction(async (transaction) => {
      const conversationDoc = await transaction.get(conversationRef);
      
      if (!conversationDoc.exists) {
        throw new Error('Conversation not found');
      }
      
      const conversationData = conversationDoc.data();
      
      if (conversationData.isLocked) {
        throw new Error('Conversation is already locked');
      }
      
      const updates = {
        isLocked: true,
        lockedBy: actorUserId,
        lockedAt: new Date(),
        lockReason: reason,
        updatedAt: new Date(),
      };
      
      transaction.update(conversationRef, updates);
      
      return {
        id: conversationId,
        ...conversationData,
        ...updates,
      };
    });
    
    logger.info('Chat conversation locked', {
      conversationId,
      actorUserId,
      reason,
    });

    return result;
  } catch (error) {
    logger.error('Failed to lock chat conversation', {
      error: error.message,
      conversationId,
      actorUserId,
      reason,
    });
    throw error;
  }
}

/**
 * Unlock a locked chat conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} actorUserId - ID of the user unlocking the conversation
 * @returns {Promise<Object>} Updated conversation
 */
async function unlockChatConversation(conversationId, actorUserId) {
  try {
    const db = getDb();
    const conversationRef = db.collection('conversations').doc(conversationId);
    
    const result = await db.runTransaction(async (transaction) => {
      const conversationDoc = await transaction.get(conversationRef);
      
      if (!conversationDoc.exists) {
        throw new Error('Conversation not found');
      }
      
      const conversationData = conversationDoc.data();
      
      if (!conversationData.isLocked) {
        throw new Error('Conversation is not locked');
      }
      
      const updates = {
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
        lockReason: null,
        updatedAt: new Date(),
      };
      
      transaction.update(conversationRef, updates);
      
      return {
        id: conversationId,
        ...conversationData,
        ...updates,
      };
    });
    
    logger.info('Chat conversation unlocked', {
      conversationId,
      actorUserId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to unlock chat conversation', {
      error: error.message,
      conversationId,
      actorUserId,
    });
    throw error;
  }
}

/**
 * Ban a user from a chat conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID to ban
 * @param {string} actorUserId - ID of the user performing the ban
 * @param {string} reason - Reason for ban
 * @returns {Promise<Object>} Updated conversation
 */
async function banUserFromChat(conversationId, userId, actorUserId, reason) {
  try {
    const db = getDb();
    const conversationRef = db.collection('conversations').doc(conversationId);
    const participantRef = conversationRef.collection('participants').doc(userId);
    
    const result = await db.runTransaction(async (transaction) => {
      const conversationDoc = await transaction.get(conversationRef);
      const participantDoc = await transaction.get(participantRef);
      
      if (!conversationDoc.exists) {
        throw new Error('Conversation not found');
      }
      
      if (!participantDoc.exists) {
        throw new Error('User is not a participant in this conversation');
      }
      
      const participantData = participantDoc.data();
      
      if (participantData.isBanned) {
        throw new Error('User is already banned from this conversation');
      }
      
      const updates = {
        isBanned: true,
        bannedBy: actorUserId,
        bannedAt: new Date(),
        banReason: reason,
        updatedAt: new Date(),
      };
      
      transaction.update(participantRef, updates);
      
      return {
        conversationId,
        userId,
        ...participantData,
        ...updates,
      };
    });
    
    logger.info('User banned from chat conversation', {
      conversationId,
      userId,
      actorUserId,
      reason,
    });

    return result;
  } catch (error) {
    logger.error('Failed to ban user from chat conversation', {
      error: error.message,
      conversationId,
      userId,
      actorUserId,
      reason,
    });
    throw error;
  }
}

/**
 * Unban a user from a chat conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID to unban
 * @param {string} actorUserId - ID of the user performing the unban
 * @returns {Promise<Object>} Updated conversation
 */
async function unbanUserFromChat(conversationId, userId, actorUserId) {
  try {
    const db = getDb();
    const conversationRef = db.collection('conversations').doc(conversationId);
    const participantRef = conversationRef.collection('participants').doc(userId);
    
    const result = await db.runTransaction(async (transaction) => {
      const conversationDoc = await transaction.get(conversationRef);
      const participantDoc = await transaction.get(participantRef);
      
      if (!conversationDoc.exists) {
        throw new Error('Conversation not found');
      }
      
      if (!participantDoc.exists) {
        throw new Error('User is not a participant in this conversation');
      }
      
      const participantData = participantDoc.data();
      
      if (!participantData.isBanned) {
        throw new Error('User is not banned from this conversation');
      }
      
      const updates = {
        isBanned: false,
        bannedBy: null,
        bannedAt: null,
        banReason: null,
        updatedAt: new Date(),
      };
      
      transaction.update(participantRef, updates);
      
      return {
        conversationId,
        userId,
        ...participantData,
        ...updates,
      };
    });
    
    logger.info('User unbanned from chat conversation', {
      conversationId,
      userId,
      actorUserId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to unban user from chat conversation', {
      error: error.message,
      conversationId,
      userId,
      actorUserId,
    });
    throw error;
  }
}

/**
 * Remove a men-review subject (soft delete)
 * @param {string} subjectId - Subject ID
 * @param {string} actorUserId - ID of the user removing the subject
 * @param {string} reason - Reason for removal
 * @returns {Promise<Object>} Updated subject
 */
async function removeMenSubject(subjectId, actorUserId, reason) {
  try {
    const db = getDb();
    const subjectRef = db.collection('men_subjects').doc(subjectId);
    
    const result = await db.runTransaction(async (transaction) => {
      const subjectDoc = await transaction.get(subjectRef);
      
      if (!subjectDoc.exists) {
        throw new Error('Subject not found');
      }
      
      const subjectData = subjectDoc.data();
      
      if (subjectData.status === 'removed') {
        throw new Error('Subject is already removed');
      }
      
      const updates = {
        status: 'removed',
        removedBy: actorUserId,
        removedAt: new Date(),
        removalReason: reason,
        updatedAt: new Date(),
      };
      
      transaction.update(subjectRef, updates);
      
      return {
        id: subjectId,
        ...subjectData,
        ...updates,
      };
    });
    
    logger.info('Men-review subject removed', {
      subjectId,
      actorUserId,
      reason,
    });

    return result;
  } catch (error) {
    logger.error('Failed to remove men-review subject', {
      error: error.message,
      subjectId,
      actorUserId,
      reason,
    });
    throw error;
  }
}

/**
 * Restore a removed men-review subject
 * @param {string} subjectId - Subject ID
 * @param {string} actorUserId - ID of the user restoring the subject
 * @returns {Promise<Object>} Updated subject
 */
async function restoreMenSubject(subjectId, actorUserId) {
  try {
    const db = getDb();
    const subjectRef = db.collection('men_subjects').doc(subjectId);
    
    const result = await db.runTransaction(async (transaction) => {
      const subjectDoc = await transaction.get(subjectRef);
      
      if (!subjectDoc.exists) {
        throw new Error('Subject not found');
      }
      
      const subjectData = subjectDoc.data();
      
      if (subjectData.status !== 'removed') {
        throw new Error('Subject is not removed');
      }
      
      const updates = {
        status: 'active',
        removedBy: null,
        removedAt: null,
        removalReason: null,
        updatedAt: new Date(),
      };
      
      transaction.update(subjectRef, updates);
      
      return {
        id: subjectId,
        ...subjectData,
        ...updates,
      };
    });
    
    logger.info('Men-review subject restored', {
      subjectId,
      actorUserId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to restore men-review subject', {
      error: error.message,
      subjectId,
      actorUserId,
    });
    throw error;
  }
}

/**
 * Approve a men-review takedown request
 * @param {string} takedownId - Takedown ID
 * @param {string} actorUserId - ID of the user approving the takedown
 * @param {string} note - Optional approval note
 * @returns {Promise<Object>} Updated takedown and removed subject
 */
async function approveMenTakedown(takedownId, actorUserId, note) {
  try {
    const db = getDb();
    const takedownRef = db.collection('men_takedowns').doc(takedownId);
    
    const result = await db.runTransaction(async (transaction) => {
      const takedownDoc = await transaction.get(takedownRef);
      
      if (!takedownDoc.exists) {
        throw new Error('Takedown request not found');
      }
      
      const takedownData = takedownDoc.data();
      
      if (takedownData.status !== 'pending') {
        throw new Error(`Takedown request is already ${takedownData.status}`);
      }
      
      // Update takedown status
      const takedownUpdates = {
        status: 'approved',
        approvedBy: actorUserId,
        approvedAt: new Date(),
        approvalNote: note || null,
        updatedAt: new Date(),
      };
      
      transaction.update(takedownRef, takedownUpdates);
      
      // Remove the subject
      const subjectRef = db.collection('men_subjects').doc(takedownData.subjectId);
      const subjectDoc = await transaction.get(subjectRef);
      
      if (subjectDoc.exists) {
        const subjectUpdates = {
          status: 'removed',
          removedBy: actorUserId,
          removedAt: new Date(),
          removalReason: `Takedown approved: ${takedownData.reason}`,
          updatedAt: new Date(),
        };
        
        transaction.update(subjectRef, subjectUpdates);
      }
      
      return {
        takedown: {
          id: takedownId,
          ...takedownData,
          ...takedownUpdates,
        },
        subjectRemoved: subjectDoc.exists,
      };
    });
    
    logger.info('Men-review takedown approved', {
      takedownId,
      actorUserId,
      note,
    });

    return result;
  } catch (error) {
    logger.error('Failed to approve men-review takedown', {
      error: error.message,
      takedownId,
      actorUserId,
      note,
    });
    throw error;
  }
}

/**
 * Reject a men-review takedown request
 * @param {string} takedownId - Takedown ID
 * @param {string} actorUserId - ID of the user rejecting the takedown
 * @param {string} note - Rejection note
 * @returns {Promise<Object>} Updated takedown
 */
async function rejectMenTakedown(takedownId, actorUserId, note) {
  try {
    const db = getDb();
    const takedownRef = db.collection('men_takedowns').doc(takedownId);
    
    const result = await db.runTransaction(async (transaction) => {
      const takedownDoc = await transaction.get(takedownRef);
      
      if (!takedownDoc.exists) {
        throw new Error('Takedown request not found');
      }
      
      const takedownData = takedownDoc.data();
      
      if (takedownData.status !== 'pending') {
        throw new Error(`Takedown request is already ${takedownData.status}`);
      }
      
      const updates = {
        status: 'rejected',
        rejectedBy: actorUserId,
        rejectedAt: new Date(),
        rejectionNote: note,
        updatedAt: new Date(),
      };
      
      transaction.update(takedownRef, updates);
      
      return {
        id: takedownId,
        ...takedownData,
        ...updates,
      };
    });
    
    logger.info('Men-review takedown rejected', {
      takedownId,
      actorUserId,
      note,
    });

    return result;
  } catch (error) {
    logger.error('Failed to reject men-review takedown', {
      error: error.message,
      takedownId,
      actorUserId,
      note,
    });
    throw error;
  }
}

module.exports = {
  // Feed moderation
  removePost,
  restorePost,
  removeComment,
  restoreComment,
  lockCommunity,
  unlockCommunity,
  
  // Chat moderation
  removeChatMessage,
  restoreChatMessage,
  lockChatConversation,
  unlockChatConversation,
  banUserFromChat,
  unbanUserFromChat,
  
  // Men-review moderation
  removeMenSubject,
  restoreMenSubject,
  approveMenTakedown,
  rejectMenTakedown,
};
