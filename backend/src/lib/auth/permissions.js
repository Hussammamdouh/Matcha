const { getFirestore } = require('firebase-admin/firestore');
const { createModuleLogger } = require('../logger');

const logger = createModuleLogger('auth:permissions');
const db = getFirestore();

/**
 * Check if a user is an admin
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if user is admin
 */
async function isAdmin(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return false;
    }

    const userData = userDoc.data();
    return userData.role === 'admin' || userData.isAdmin === true;
  } catch (error) {
    logger.error('Failed to check admin status', { error: error.message, userId });
    return false;
  }
}

/**
 * Check if a user is a moderator
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if user is moderator
 */
async function isModerator(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return false;
    }

    const userData = userDoc.data();
    return userData.role === 'moderator' || userData.isModerator === true;
  } catch (error) {
    logger.error('Failed to check moderator status', { error: error.message, userId });
    return false;
  }
}

/**
 * Check if a user has a specific role
 * @param {string} userId - User ID to check
 * @param {string} role - Role to check for
 * @returns {Promise<boolean>} True if user has the role
 */
async function hasRole(userId, role) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return false;
    }

    const userData = userDoc.data();
    return userData.role === role;
  } catch (error) {
    logger.error('Failed to check user role', { error: error.message, userId, role });
    return false;
  }
}

/**
 * Check if a user has any of the specified roles
 * @param {string} userId - User ID to check
 * @param {Array<string>} roles - Roles to check for
 * @returns {Promise<boolean>} True if user has any of the roles
 */
async function hasAnyRole(userId, roles) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return false;
    }

    const userData = userDoc.data();
    return roles.includes(userData.role);
  } catch (error) {
    logger.error('Failed to check user roles', { error: error.message, userId, roles });
    return false;
  }
}

/**
 * Get user's role
 * @param {string} userId - User ID to get role for
 * @returns {Promise<string|null>} User's role or null if not found
 */
async function getUserRole(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data();
    return userData.role || null;
  } catch (error) {
    logger.error('Failed to get user role', { error: error.message, userId });
    return null;
  }
}

module.exports = {
  isAdmin,
  isModerator,
  hasRole,
  hasAnyRole,
  getUserRole,
};
