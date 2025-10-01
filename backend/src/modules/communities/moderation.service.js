const { getFirestore } = require('../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');

const logger = createModuleLogger('communities:moderation:service');
let db;

/**
 * Check if user has moderation permissions in a community
 * @param {string} communityId - Community ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if user can moderate
 */
async function canModerate(communityId, userId) {
  db = db || getFirestore();
  try {
    const communityDoc = await db.collection('communities').doc(communityId).get();
    
    if (!communityDoc.exists) {
      return false;
    }
    
    const community = communityDoc.data();
    return community.ownerId === userId || (community.modIds || []).includes(userId);
  } catch (error) {
    logger.error('Failed to check moderation permissions', { error: error.message, communityId, userId });
    return false;
  }
}

/**
 * Get community moderators with user details
 * @param {string} communityId - Community ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Moderators with pagination
 */
async function getModerators(communityId, options = {}) {
  db = db || getFirestore();
  try {
    const { cursor, pageSize = 20 } = options;
    const limit = Math.min(pageSize, 100);

    // Get community to find moderators
    const communityDoc = await db.collection('communities').doc(communityId).get();
    
    if (!communityDoc.exists) {
      throw new Error('Community not found');
    }
    
    const community = communityDoc.data();
    const moderatorIds = [...(community.modIds || []), community.ownerId];
    
    if (moderatorIds.length === 0) {
      return {
        moderators: [],
        pagination: {
          pageSize: limit,
          hasMore: false,
          nextCursor: null,
        },
      };
    }

    // Get moderator details
    const moderators = [];
    if (moderatorIds.length > 0) {
      const usersSnapshot = await db.collection('users')
        .where('uid', 'in', moderatorIds)
        .get();

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        const isOwner = userData.uid === community.ownerId;
        moderators.push({
          uid: userData.uid,
          nickname: userData.nickname,
          avatarUrl: userData.avatarUrl || null,
          bio: userData.bio || null,
          status: userData.status,
          role: isOwner ? 'owner' : 'moderator',
          createdAt: userData.createdAt,
        });
      });
    }

    // Sort: owner first, then moderators by nickname
    moderators.sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (a.role !== 'owner' && b.role === 'owner') return 1;
      return a.nickname.localeCompare(b.nickname);
    });

    // Apply pagination
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = moderators.findIndex(m => m.uid === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedModerators = moderators.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < moderators.length;
    const nextCursor = hasMore ? paginatedModerators[paginatedModerators.length - 1]?.uid : null;

    return {
      moderators: paginatedModerators,
      pagination: {
        pageSize: limit,
        hasMore,
        nextCursor,
      },
    };
  } catch (error) {
    logger.error('Failed to get moderators', { error: error.message, communityId });
    throw error;
  }
}

/**
 * Add a moderator to a community
 * @param {string} communityId - Community ID
 * @param {string} moderatorUserId - User ID to make moderator
 * @param {string} actorUserId - User ID performing the action
 * @returns {Promise<Object>} Updated moderator info
 */
async function addModerator(communityId, moderatorUserId, actorUserId) {
  db = db || getFirestore();
  try {
    // Check if actor can moderate
    if (!(await canModerate(communityId, actorUserId))) {
      throw new Error('Insufficient permissions to add moderators');
    }

    // Check if user is already a moderator or owner
    const communityDoc = await db.collection('communities').doc(communityId).get();
    
    if (!communityDoc.exists) {
      throw new Error('Community not found');
    }
    
    const community = communityDoc.data();
    
    if (community.ownerId === moderatorUserId) {
      throw new Error('User is already the owner of this community');
    }
    
    if ((community.modIds || []).includes(moderatorUserId)) {
      throw new Error('User is already a moderator');
    }

    // Check if user is a member of the community
    const membershipQuery = await db.collection('community_members')
      .where('userId', '==', moderatorUserId)
      .where('communityId', '==', communityId)
      .limit(1)
      .get();

    if (membershipQuery.empty) {
      throw new Error('User must be a member of the community to become a moderator');
    }

    // Add to moderators
    const newModIds = [...(community.modIds || []), moderatorUserId];
    
    await db.collection('communities').doc(communityId).update({
      modIds: newModIds,
      updatedAt: new Date(),
    });

    // Update membership role
    const membershipDoc = membershipQuery.docs[0];
    await membershipDoc.ref.update({
      role: 'moderator',
      updatedAt: new Date(),
    });

    // Get updated moderator info
    const moderatorDoc = await db.collection('users').doc(moderatorUserId).get();
    const moderatorData = moderatorDoc.data();

    logger.info('Moderator added to community', {
      communityId,
      moderatorUserId,
      actorUserId,
    });

    return {
      uid: moderatorData.uid,
      nickname: moderatorData.nickname,
      avatarUrl: moderatorData.avatarUrl || null,
      bio: moderatorData.bio || null,
      status: moderatorData.status,
      role: 'moderator',
      createdAt: moderatorData.createdAt,
    };
  } catch (error) {
    logger.error('Failed to add moderator', { 
      error: error.message, 
      communityId, 
      moderatorUserId, 
      actorUserId 
    });
    throw error;
  }
}

/**
 * Remove a moderator from a community
 * @param {string} communityId - Community ID
 * @param {string} moderatorUserId - User ID to remove as moderator
 * @param {string} actorUserId - User ID performing the action
 * @returns {Promise<boolean>} Success status
 */
async function removeModerator(communityId, moderatorUserId, actorUserId) {
  db = db || getFirestore();
  try {
    // Check if actor can moderate
    if (!(await canModerate(communityId, actorUserId))) {
      throw new Error('Insufficient permissions to remove moderators');
    }

    // Check if trying to remove owner
    const communityDoc = await db.collection('communities').doc(communityId).get();
    
    if (!communityDoc.exists) {
      throw new Error('Community not found');
    }
    
    const community = communityDoc.data();
    
    if (community.ownerId === moderatorUserId) {
      throw new Error('Cannot remove the owner as a moderator');
    }

    // Remove from moderators
    const newModIds = (community.modIds || []).filter(id => id !== moderatorUserId);
    
    await db.collection('communities').doc(communityId).update({
      modIds: newModIds,
      updatedAt: new Date(),
    });

    // Update membership role back to member
    const membershipQuery = await db.collection('community_members')
      .where('userId', '==', moderatorUserId)
      .where('communityId', '==', communityId)
      .limit(1)
      .get();

    if (!membershipQuery.empty) {
      const membershipDoc = membershipQuery.docs[0];
      await membershipDoc.ref.update({
        role: 'member',
        updatedAt: new Date(),
      });
    }

    logger.info('Moderator removed from community', {
      communityId,
      moderatorUserId,
      actorUserId,
    });

    return true;
  } catch (error) {
    logger.error('Failed to remove moderator', { 
      error: error.message, 
      communityId, 
      moderatorUserId, 
      actorUserId 
    });
    throw error;
  }
}

/**
 * Ban a user from a community
 * @param {string} communityId - Community ID
 * @param {string} bannedUserId - User ID to ban
 * @param {string} actorUserId - User ID performing the action
 * @param {string} reason - Reason for ban (optional)
 * @returns {Promise<Object>} Ban record
 */
async function banUser(communityId, bannedUserId, actorUserId, reason = '') {
  db = db || getFirestore();
  try {
    // Check if actor can moderate
    if (!(await canModerate(communityId, actorUserId))) {
      throw new Error('Insufficient permissions to ban users');
    }

    // Check if trying to ban owner
    const communityDoc = await db.collection('communities').doc(communityId).get();
    
    if (!communityDoc.exists) {
      throw new Error('Community not found');
    }
    
    const community = communityDoc.data();
    
    if (community.ownerId === bannedUserId) {
      throw new Error('Cannot ban the owner of the community');
    }

    // Check if user is already banned
    const existingBanQuery = await db.collection('community_bans')
      .where('communityId', '==', communityId)
      .where('bannedUserId', '==', bannedUserId)
      .limit(1)
      .get();

    if (!existingBanQuery.empty) {
      throw new Error('User is already banned from this community');
    }

    // Create ban record
    const banRef = db.collection('community_bans').doc();
    const banData = {
      id: banRef.id,
      communityId,
      bannedUserId,
      bannedBy: actorUserId,
      reason: reason || 'No reason provided',
      bannedAt: new Date(),
      isActive: true,
    };

    await banRef.set(banData);

    // Remove user from community if they're a member
    const membershipQuery = await db.collection('community_members')
      .where('userId', '==', bannedUserId)
      .where('communityId', '==', communityId)
      .limit(1)
      .get();

    if (!membershipQuery.empty) {
      await membershipQuery.docs[0].ref.delete();
      
      // Update community member count
      await db.collection('communities').doc(communityId).update({
        memberCount: Math.max(0, (community.memberCount || 1) - 1),
        updatedAt: new Date(),
      });
    }

    // Remove from moderators if applicable
    if ((community.modIds || []).includes(bannedUserId)) {
      const newModIds = community.modIds.filter(id => id !== bannedUserId);
      await db.collection('communities').doc(communityId).update({
        modIds: newModIds,
        updatedAt: new Date(),
      });
    }

    logger.info('User banned from community', {
      communityId,
      bannedUserId,
      actorUserId,
      reason,
    });

    return banData;
  } catch (error) {
    logger.error('Failed to ban user', { 
      error: error.message, 
      communityId, 
      bannedUserId, 
      actorUserId 
    });
    throw error;
  }
}

/**
 * Unban a user from a community
 * @param {string} communityId - Community ID
 * @param {string} bannedUserId - User ID to unban
 * @param {string} actorUserId - User ID performing the action
 * @returns {Promise<boolean>} Success status
 */
async function unbanUser(communityId, bannedUserId, actorUserId) {
  db = db || getFirestore();
  try {
    // Check if actor can moderate
    if (!(await canModerate(communityId, actorUserId))) {
      throw new Error('Insufficient permissions to unban users');
    }

    // Find and deactivate ban
    const banQuery = await db.collection('community_bans')
      .where('communityId', '==', communityId)
      .where('bannedUserId', '==', bannedUserId)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (banQuery.empty) {
      throw new Error('User is not banned from this community');
    }

    const banDoc = banQuery.docs[0];
    await banDoc.ref.update({
      isActive: false,
      unbannedAt: new Date(),
      unbannedBy: actorUserId,
    });

    logger.info('User unbanned from community', {
      communityId,
      bannedUserId,
      actorUserId,
    });

    return true;
  } catch (error) {
    logger.error('Failed to unban user', { 
      error: error.message, 
      communityId, 
      bannedUserId, 
      actorUserId 
    });
    throw error;
  }
}

/**
 * Get banned users from a community
 * @param {string} communityId - Community ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Banned users with pagination
 */
async function getBannedUsers(communityId, options = {}) {
  db = db || getFirestore();
  try {
    const { cursor, pageSize = 20 } = options;
    const limit = Math.min(pageSize, 100);

    // Get all active bans for the community
    const bansSnapshot = await db.collection('community_bans')
      .where('communityId', '==', communityId)
      .where('isActive', '==', true)
      .get();

    // Process in memory for pagination and sorting
    let allBans = [];
    bansSnapshot.forEach(doc => {
      allBans.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Sort by bannedAt descending
    allBans.sort((a, b) => {
      const aTime = a.bannedAt?.toDate ? a.bannedAt.toDate() : new Date(a.bannedAt);
      const bTime = b.bannedAt?.toDate ? b.bannedAt.toDate() : new Date(b.bannedAt);
      return bTime - aTime;
    });

    // Apply pagination
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = allBans.findIndex(b => b.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedBans = allBans.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < allBans.length;
    const bannedUserIds = paginatedBans.map(b => b.bannedUserId);

    // Get user details for banned users (chunked by 10 due to Firestore 'in' limit)
    const bannedUsers = [];
    if (bannedUserIds.length > 0) {
      const chunkSize = 10;
      for (let i = 0; i < bannedUserIds.length; i += chunkSize) {
        const chunk = bannedUserIds.slice(i, i + chunkSize);
        const usersSnapshot = await db.collection('users')
          .where('uid', 'in', chunk)
          .get();

        usersSnapshot.forEach(doc => {
          const userData = doc.data();
          const banRecord = paginatedBans.find(b => b.bannedUserId === userData.uid);
          bannedUsers.push({
            uid: userData.uid,
            nickname: userData.nickname,
            avatarUrl: userData.avatarUrl || null,
            bio: userData.bio || null,
            status: userData.status,
            bannedAt: banRecord?.bannedAt || null,
            bannedBy: banRecord?.bannedBy || null,
            reason: banRecord?.reason || null,
          });
        });
      }

      // Include any bans whose user document is missing
      const foundIds = new Set(bannedUsers.map(u => u.uid));
      for (const ban of paginatedBans) {
        if (!foundIds.has(ban.bannedUserId)) {
          bannedUsers.push({
            uid: ban.bannedUserId,
            nickname: null,
            avatarUrl: null,
            bio: null,
            status: null,
            bannedAt: ban.bannedAt,
            bannedBy: ban.bannedBy,
            reason: ban.reason,
          });
        }
      }
    }

    const nextCursor = hasMore ? paginatedBans[paginatedBans.length - 1]?.id : null;

    return {
      bannedUsers,
      pagination: {
        pageSize: limit,
        hasMore,
        nextCursor,
      },
    };
  } catch (error) {
    logger.error('Failed to get banned users', { error: error.message, communityId });
    throw error;
  }
}

/**
 * Check if user is banned from a community
 * @param {string} communityId - Community ID
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if banned
 */
async function isUserBanned(communityId, userId) {
  db = db || getFirestore();
  try {
    const banQuery = await db.collection('community_bans')
      .where('communityId', '==', communityId)
      .where('bannedUserId', '==', userId)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    return !banQuery.empty;
  } catch (error) {
    logger.error('Failed to check if user is banned', { error: error.message, communityId, userId });
    return false;
  }
}

module.exports = {
  canModerate,
  getModerators,
  addModerator,
  removeModerator,
  banUser,
  unbanUser,
  getBannedUsers,
  isUserBanned,
};
