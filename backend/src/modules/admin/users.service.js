const { getFirestore } = require('../../../lib/firebase');
const { getAuth } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');

// Remove top-level Firebase initialization
// const db = getFirestore();
// const auth = getAuth();
const logger = createModuleLogger('admin:users:service');

/**
 * Get Firestore instance (lazy-loaded)
 * @returns {Object} Firestore instance
 */
function getDb() {
  return getFirestore();
}

/**
 * Get Auth instance (lazy-loaded)
 * @returns {Object} Auth instance
 */
function getAuthInstance() {
  return getAuth();
}

/**
 * Set user role (admin, moderator, user)
 * @param {string} uid - User ID
 * @param {string} role - New role
 * @param {string} actorUserId - ID of the user setting the role
 * @returns {Promise<Object>} Updated user
 */
async function setUserRole(uid, role, actorUserId) {
  try {
    const db = getDb();
    const auth = getAuthInstance();
    
    // Validate role
    if (!['admin', 'moderator', 'user'].includes(role)) {
      throw new Error('Invalid role. Must be admin, moderator, or user');
    }

    // Update Firebase custom claims
    await auth.setCustomUserClaims(uid, { role });
    
    // Update Firestore profile
    const userRef = db.collection('users').doc(uid);
    
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('User profile not found');
      }
      
      const userData = userDoc.data();
      
      const updates = {
        role,
        roleUpdatedBy: actorUserId,
        roleUpdatedAt: new Date(),
        updatedAt: new Date(),
      };
      
      transaction.update(userRef, updates);
      
      return {
        uid,
        ...userData,
        ...updates,
      };
    });
    
    logger.info('User role updated', {
      uid,
      role,
      actorUserId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to set user role', {
      error: error.message,
      uid,
      role,
      actorUserId,
    });
    throw error;
  }
}

/**
 * Ban a user (suspend account)
 * @param {string} uid - User ID
 * @param {string} actorUserId - ID of the user performing the ban
 * @param {string} reason - Reason for ban
 * @param {Date} until - Ban until date (optional, permanent if not provided)
 * @returns {Promise<Object>} Updated user
 */
async function banUser(uid, actorUserId, reason, until = null) {
  try {
    const db = getDb();
    const auth = getAuthInstance();
    
    const userRef = db.collection('users').doc(uid);
    
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('User profile not found');
      }
      
      const userData = userDoc.data();
      
      if (userData.status === 'suspended') {
        throw new Error('User is already suspended');
      }
      
      const updates = {
        status: 'suspended',
        suspendedBy: actorUserId,
        suspendedAt: new Date(),
        suspensionReason: reason,
        suspensionUntil: until,
        updatedAt: new Date(),
      };
      
      transaction.update(userRef, updates);
      
      return {
        uid,
        ...userData,
        ...updates,
      };
    });
    
    // Revoke all refresh tokens
    try {
      await auth.revokeRefreshTokens(uid);
    } catch (tokenError) {
      logger.warn('Failed to revoke refresh tokens', {
        uid,
        error: tokenError.message,
      });
    }
    
    logger.info('User banned', {
      uid,
      actorUserId,
      reason,
      until,
    });

    return result;
  } catch (error) {
    logger.error('Failed to ban user', {
      error: error.message,
      uid,
      actorUserId,
      reason,
      until,
    });
    throw error;
  }
}

/**
 * Unban a user (restore account)
 * @param {string} uid - User ID
 * @param {string} actorUserId - ID of the user performing the unban
 * @returns {Promise<Object>} Updated user
 */
async function unbanUser(uid, actorUserId) {
  try {
    const db = getDb();
    const userRef = db.collection('users').doc(uid);
    
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('User profile not found');
      }
      
      const userData = userDoc.data();
      
      if (userData.status !== 'suspended') {
        throw new Error('User is not suspended');
      }
      
      const updates = {
        status: 'active',
        suspendedBy: null,
        suspendedAt: null,
        suspensionReason: null,
        suspensionUntil: null,
        updatedAt: new Date(),
      };
      
      transaction.update(userRef, updates);
      
      return {
        uid,
        ...userData,
        ...updates,
      };
    });
    
    logger.info('User unbanned', {
      uid,
      actorUserId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to unban user', {
      error: error.message,
      uid,
      actorUserId,
    });
    throw error;
  }
}

/**
 * Shadowban a user (hide content from others)
 * @param {string} uid - User ID
 * @param {string} actorUserId - ID of the user performing the shadowban
 * @param {string} reason - Reason for shadowban
 * @returns {Promise<Object>} Updated user
 */
async function shadowbanUser(uid, actorUserId, reason) {
  try {
    const db = getDb();
    const userRef = db.collection('users').doc(uid);
    
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('User profile not found');
      }
      
      const userData = userDoc.data();
      
      if (userData.isShadowbanned) {
        throw new Error('User is already shadowbanned');
      }
      
      const updates = {
        isShadowbanned: true,
        shadowbannedBy: actorUserId,
        shadowbannedAt: new Date(),
        shadowbanReason: reason,
        updatedAt: new Date(),
      };
      
      transaction.update(userRef, updates);
      
      return {
        uid,
        ...userData,
        ...updates,
      };
    });
    
    logger.info('User shadowbanned', {
      uid,
      actorUserId,
      reason,
    });

    return result;
  } catch (error) {
    logger.error('Failed to shadowban user', {
      error: error.message,
      uid,
      actorUserId,
      reason,
    });
    throw error;
  }
}

/**
 * Remove shadowban from a user
 * @param {string} uid - User ID
 * @param {string} actorUserId - ID of the user removing the shadowban
 * @returns {Promise<Object>} Updated user
 */
async function unshadowbanUser(uid, actorUserId) {
  try {
    const db = getDb();
    const userRef = db.collection('users').doc(uid);
    
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('User profile not found');
      }
      
      const userData = userDoc.data();
      
      if (!userData.isShadowbanned) {
        throw new Error('User is not shadowbanned');
      }
      
      const updates = {
        isShadowbanned: false,
        shadowbannedBy: null,
        shadowbannedAt: null,
        shadowbanReason: null,
        updatedAt: new Date(),
      };
      
      transaction.update(userRef, updates);
      
      return {
        uid,
        ...userData,
        ...updates,
      };
    });
    
    logger.info('User shadowban removed', {
      uid,
      actorUserId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to remove user shadowban', {
      error: error.message,
      uid,
      actorUserId,
    });
    throw error;
  }
}

/**
 * Logout all user sessions (revoke all refresh tokens)
 * @param {string} uid - User ID
 * @param {string} actorUserId - ID of the user performing the logout
 * @returns {Promise<Object>} Result
 */
async function logoutAllUserSessions(uid, actorUserId) {
  try {
    const auth = getAuthInstance();
    
    // Revoke all refresh tokens
    await auth.revokeRefreshTokens(uid);
    
    logger.info('All user sessions logged out', {
      uid,
      actorUserId,
    });

    return {
      uid,
      sessionsRevoked: true,
      revokedAt: new Date(),
      revokedBy: actorUserId,
    };
  } catch (error) {
    logger.error('Failed to logout all user sessions', {
      error: error.message,
      uid,
      actorUserId,
    });
    throw error;
  }
}

/**
 * Search users with filtering and pagination
 * @param {Object} options - Search options
 * @param {string} options.q - Search query (nickname, email)
 * @param {string} options.status - Filter by status
 * @param {string} options.role - Filter by role
 * @param {string} options.cursor - Pagination cursor
 * @param {number} options.limit - Maximum number of results
 * @returns {Promise<Object>} Paginated users
 */
async function searchUsers(options = {}) {
  try {
    const db = getDb();
    const {
      q,
      status,
      role,
      cursor,
      limit = 20,
    } = options;

    // Validate limit
    const maxLimit = Math.min(limit, 50);
    
    let query = db.collection('users');
    
    // Apply filters
    if (status) {
      query = query.where('status', '==', status);
    }
    
    if (role) {
      query = query.where('role', '==', role);
    }
    
    // Get users ordered by nickname
    const snapshot = await query.orderBy('nickname', 'asc').limit(maxLimit).get();
    
    let users = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    }));
    
    // Apply search query in memory to avoid composite indexes
    if (q) {
      const searchTerm = q.toLowerCase();
      users = users.filter(user => {
        const nickname = (user.nickname || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        return nickname.includes(searchTerm) || email.includes(searchTerm);
      });
    }
    
    // Apply cursor-based pagination
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = users.findIndex(user => user.uid === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }
    
    const paginatedUsers = users.slice(startIndex, startIndex + maxLimit);
    const hasMore = startIndex + maxLimit < users.length;
    const nextCursor = hasMore ? paginatedUsers[paginatedUsers.length - 1]?.uid : null;
    
    // Remove sensitive information
    const sanitizedUsers = paginatedUsers.map(user => ({
      uid: user.uid,
      nickname: user.nickname,
      email: user.email,
      role: user.role,
      status: user.status,
      isShadowbanned: user.isShadowbanned,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
    
    logger.info('Users searched', {
      total: users.length,
      returned: sanitizedUsers.length,
      hasMore,
      filters: { q, status, role },
    });

    return {
      users: sanitizedUsers,
      meta: {
        total: users.length,
        returned: sanitizedUsers.length,
        hasMore,
        nextCursor,
        filters: { q, status, role },
      },
    };
  } catch (error) {
    logger.error('Failed to search users', {
      error: error.message,
      options,
    });
    throw error;
  }
}

/**
 * Get detailed user information
 * @param {string} uid - User ID
 * @returns {Promise<Object>} User details
 */
async function getUserDetails(uid) {
  try {
    const db = getDb();
    const auth = getAuthInstance();
    
    // Get Firestore profile
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      throw new Error('User profile not found');
    }
    
    const userData = userDoc.data();
    
    // Get Firebase Auth user record
    let authUser = null;
    try {
      authUser = await auth.getUser(uid);
    } catch (authError) {
      logger.warn('Failed to get Firebase Auth user', {
        uid,
        error: authError.message,
      });
    }
    
    // Combine data
    const userDetails = {
      uid,
      ...userData,
      auth: authUser ? {
        emailVerified: authUser.emailVerified,
        disabled: authUser.disabled,
        metadata: {
          creationTime: authUser.metadata.creationTime,
          lastSignInTime: authUser.metadata.lastSignInTime,
        },
      } : null,
    };
    
    logger.info('User details retrieved', {
      uid,
      hasAuthData: !!authUser,
    });

    return userDetails;
  } catch (error) {
    logger.error('Failed to get user details', {
      error: error.message,
      uid,
    });
    throw error;
  }
}

module.exports = {
  setUserRole,
  banUser,
  unbanUser,
  shadowbanUser,
  unshadowbanUser,
  logoutAllUserSessions,
  searchUsers,
  getUserDetails,
};
