const { db } = require('../lib/firebase');
const { createModuleLogger } = require('../lib/logger');
const logger = createModuleLogger('rbac');

/**
 * Role-Based Access Control (RBAC) middleware
 * Controls access to admin routes based on user roles and permissions
 */

// Define available roles and their hierarchy
const ROLES = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
};

// Define role hierarchy (higher index = more privileges)
const ROLE_HIERARCHY = {
  [ROLES.USER]: 0,
  [ROLES.MODERATOR]: 1,
  [ROLES.ADMIN]: 2,
  [ROLES.SUPER_ADMIN]: 3
};

// Define base permissions for each role
const USER_PERMISSIONS = [
  'read_own_posts',
  'create_posts',
  'edit_own_posts',
  'delete_own_posts',
  'vote_posts',
  'comment_posts',
  'report_content'
];

const MODERATOR_PERMISSIONS = [
  ...USER_PERMISSIONS,
  'moderate_posts',
  'moderate_comments',
  'moderate_users',
  'view_reports',
  'lock_content',
  'warn_users',
  'temporary_ban_users'
];

const ADMIN_PERMISSIONS = [
  ...MODERATOR_PERMISSIONS,
  'manage_communities',
  'manage_feature_flags',
  'view_analytics',
  'export_data',
  'permanent_ban_users',
  'manage_moderators',
  'system_configuration'
];

const SUPER_ADMIN_PERMISSIONS = [
  ...ADMIN_PERMISSIONS,
  'manage_admins',
  'system_maintenance',
  'database_operations',
  'security_audit',
  'feature_rollout'
];

// Define permissions for each role
const ROLE_PERMISSIONS = {
  [ROLES.USER]: USER_PERMISSIONS,
  [ROLES.MODERATOR]: MODERATOR_PERMISSIONS,
  [ROLES.ADMIN]: ADMIN_PERMISSIONS,
  [ROLES.SUPER_ADMIN]: SUPER_ADMIN_PERMISSIONS
};

/**
 * Check if a user has a specific permission
 * @param {string} userRole - User's role
 * @param {string} permission - Permission to check
 * @returns {boolean} True if user has permission
 */
function hasPermission(userRole, permission) {
  if (!userRole || !ROLE_PERMISSIONS[userRole]) {
    return false;
  }
  
  return ROLE_PERMISSIONS[userRole].includes(permission);
}

/**
 * Check if a user has at least the specified role
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Minimum required role
 * @returns {boolean} True if user meets role requirement
 */
function hasRole(userRole, requiredRole) {
  if (!userRole || !requiredRole) {
    return false;
  }
  
  const userLevel = ROLE_HIERARCHY[userRole] || -1;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || Infinity;
  
  return userLevel >= requiredLevel;
}

/**
 * Get user role from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<string>} User's role
 */
async function getUserRole(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return ROLES.USER;
    }
    
    const userData = userDoc.data();
    return userData.role || userData.adminRole || ROLES.USER;
  } catch (error) {
    logger.error('Failed to get user role', { error: error.message, userId });
    return ROLES.USER;
  }
}

/**
 * Check if user is banned or suspended
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Ban status
 */
async function getUserBanStatus(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return { isBanned: false, isSuspended: false };
    }
    
    const userData = userDoc.data();
    return {
      isBanned: userData.isBanned || false,
      isSuspended: userData.isSuspended || false,
      banReason: userData.banReason,
      suspensionEndsAt: userData.suspensionEndsAt
    };
  } catch (error) {
    logger.error('Failed to get user ban status', { error: error.message, userId });
    return { isBanned: false, isSuspended: false };
  }
}

/**
 * Create RBAC middleware that requires a specific role
 * @param {string} requiredRole - Minimum required role
 * @param {Array<string>} requiredPermissions - Required permissions
 * @returns {Function} Express middleware
 */
function requireRole(requiredRole, requiredPermissions = []) {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user || !req.user.uid) {
        logger.warn('Unauthenticated access attempt to admin route', {
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        return res.status(401).json({
          ok: false,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required'
          }
        });
      }

      const userId = req.user.uid;
      
      // Get user role and ban status
      const [userRole, banStatus] = await Promise.all([
        getUserRole(userId),
        getUserBanStatus(userId)
      ]);

      // Check if user is banned
      if (banStatus.isBanned) {
        logger.warn('Banned user attempted admin access', {
          userId,
          path: req.path,
          method: req.method,
          banReason: banStatus.banReason
        });
        
        return res.status(403).json({
          ok: false,
          error: {
            code: 'USER_BANNED',
            message: 'Your account has been banned',
            reason: banStatus.banReason
          }
        });
      }

      // Check if user is suspended
      if (banStatus.isSuspended) {
        const suspensionEndsAt = new Date(banStatus.suspensionEndsAt);
        if (suspensionEndsAt > new Date()) {
          logger.warn('Suspended user attempted admin access', {
            userId,
            path: req.path,
            method: req.method,
            suspensionEndsAt: banStatus.suspensionEndsAt
          });
          
          return res.status(403).json({
            ok: false,
            error: {
              code: 'USER_SUSPENDED',
              message: 'Your account is temporarily suspended',
              suspensionEndsAt: banStatus.suspensionEndsAt
            }
          });
        }
      }

      // Check role requirement
      if (!hasRole(userRole, requiredRole)) {
        logger.warn('Insufficient role for admin access', {
          userId,
          userRole,
          requiredRole,
          path: req.path,
          method: req.method
        });
        
        return res.status(403).json({
          ok: false,
          error: {
            code: 'INSUFFICIENT_ROLE',
            message: `Role '${requiredRole}' or higher required`,
            currentRole: userRole,
            requiredRole
          }
        });
      }

      // Check permission requirements
      for (const permission of requiredPermissions) {
        if (!hasPermission(userRole, permission)) {
          logger.warn('Insufficient permissions for admin access', {
            userId,
            userRole,
            requiredPermission: permission,
            path: req.path,
            method: req.method
          });
          
          return res.status(403).json({
            ok: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: `Permission '${permission}' required`,
              currentRole: userRole,
              requiredPermission: permission
            }
          });
        }
      }

      // Add role and permissions to request for downstream use
      req.userRole = userRole;
      req.userPermissions = ROLE_PERMISSIONS[userRole] || [];
      
      logger.debug('RBAC check passed', {
        userId,
        userRole,
        requiredRole,
        requiredPermissions,
        path: req.path,
        method: req.method
      });

      next();
    } catch (error) {
      logger.error('RBAC middleware error', {
        error: error.message,
        userId: req.user?.uid,
        path: req.path,
        method: req.method
      });
      
      return res.status(500).json({
        ok: false,
        error: {
          code: 'RBAC_ERROR',
          message: 'Access control check failed'
        }
      });
    }
  };
}

/**
 * Create RBAC middleware that requires specific permissions
 * @param {Array<string>} requiredPermissions - Required permissions
 * @returns {Function} Express middleware
 */
function requirePermissions(requiredPermissions) {
  return requireRole(ROLES.USER, requiredPermissions);
}

/**
 * Create RBAC middleware for moderator actions
 * @returns {Function} Express middleware
 */
function requireModerator() {
  return requireRole(ROLES.MODERATOR);
}

/**
 * Create RBAC middleware for admin actions
 * @returns {Function} Express middleware
 */
function requireAdmin() {
  return requireRole(ROLES.ADMIN);
}

/**
 * Create RBAC middleware for super admin actions
 * @returns {Function} Express middleware
 */
function requireSuperAdmin() {
  return requireRole(ROLES.SUPER_ADMIN);
}

/**
 * Check if user can moderate specific content
 * @param {string} userId - User ID
 * @param {string} contentUserId - Content creator's user ID
 * @returns {Promise<boolean>} True if user can moderate
 */
async function canModerateContent(userId, contentUserId) {
  try {
    // Users cannot moderate their own content
    if (userId === contentUserId) {
      return false;
    }

    const userRole = await getUserRole(userId);
    
    // Only moderators and admins can moderate content
    return hasRole(userRole, ROLES.MODERATOR);
  } catch (error) {
    logger.error('Failed to check moderation permission', { error: error.message, userId, contentUserId });
    return false;
  }
}

/**
 * Check if user can manage another user
 * @param {string} managerId - Manager's user ID
 * @param {string} targetUserId - Target user's ID
 * @returns {Promise<boolean>} True if user can manage target
 */
async function canManageUser(managerId, targetUserId) {
  try {
    // Users cannot manage themselves
    if (managerId === targetUserId) {
      return false;
    }

    const [managerRole, targetRole] = await Promise.all([
      getUserRole(managerId),
      getUserRole(targetUserId)
    ]);

    // Only admins can manage other admins
    if (hasRole(targetRole, ROLES.ADMIN)) {
      return hasRole(managerRole, ROLES.SUPER_ADMIN);
    }

    // Moderators and admins can manage regular users
    return hasRole(managerRole, ROLES.MODERATOR);
  } catch (error) {
    logger.error('Failed to check user management permission', { error: error.message, managerId, targetUserId });
    return false;
  }
}

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  requireRole,
  requirePermissions,
  requireModerator,
  requireAdmin,
  requireSuperAdmin,
  hasPermission,
  hasRole,
  getUserRole,
  getUserBanStatus,
  canModerateContent,
  canManageUser
};
