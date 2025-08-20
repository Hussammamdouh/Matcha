const { createModuleLogger } = require('../../lib/logger');

const logger = createModuleLogger('admin:rbac');

// Role hierarchy and permissions matrix
const ROLE_PERMISSIONS = {
  admin: {
    // User management
    canManageRoles: true,
    canBanUsers: true,
    canShadowbanUsers: true,
    canLogoutUsers: true,
    
    // Content moderation
    canModerateFeed: true,
    canModerateChat: true,
    canModerateMen: true,
    
    // System management
    canManageFeatures: true,
    canViewMetrics: true,
    canExportContent: true,
    canViewAudits: true,
    
    // Report management
    canManageReports: true,
    canBulkActions: true,
  },
  
  moderator: {
    // User management (limited)
    canManageRoles: false,
    canBanUsers: true,
    canShadowbanUsers: true,
    canLogoutUsers: false,
    
    // Content moderation
    canModerateFeed: true,
    canModerateChat: true,
    canModerateMen: true,
    
    // System management (limited)
    canManageFeatures: false,
    canViewMetrics: true,
    canExportContent: true,
    canViewAudits: true,
    
    // Report management
    canManageReports: true,
    canBulkActions: true,
  },
  
  user: {
    // No admin permissions
    canManageRoles: false,
    canBanUsers: false,
    canShadowbanUsers: false,
    canLogoutUsers: false,
    canModerateFeed: false,
    canModerateChat: false,
    canModerateMen: false,
    canManageFeatures: false,
    canViewMetrics: false,
    canExportContent: false,
    canViewAudits: false,
    canManageReports: false,
    canBulkActions: false,
  }
};

/**
 * Check if user has a specific permission
 * @param {string} userId - User ID
 * @param {string} permission - Permission to check
 * @param {Object} customClaims - User's custom claims
 * @returns {boolean} Whether user has permission
 */
function hasPermission(userId, permission, customClaims = {}) {
  const role = customClaims.role || 'user';
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.user;
  
  const hasAccess = permissions[permission] || false;
  
  logger.debug('Permission check', {
    userId,
    role,
    permission,
    hasAccess,
  });
  
  return hasAccess;
}

/**
 * Check if user can perform admin action
 * @param {string} userId - User ID
 * @param {string} action - Action to perform
 * @param {Object} customClaims - User's custom claims
 * @returns {boolean} Whether user can perform action
 */
function canPerformAction(userId, action, customClaims = {}) {
  // Map actions to permissions
  const actionPermissions = {
    // User management
    'users.setRole': 'canManageRoles',
    'users.ban': 'canBanUsers',
    'users.unban': 'canBanUsers',
    'users.shadowban': 'canShadowbanUsers',
    'users.unshadowban': 'canShadowbanUsers',
    'users.logoutAll': 'canLogoutUsers',
    
    // Content moderation
    'posts.remove': 'canModerateFeed',
    'posts.restore': 'canModerateFeed',
    'comments.remove': 'canModerateFeed',
    'comments.restore': 'canModerateFeed',
    'communities.lock': 'canModerateFeed',
    'communities.unlock': 'canModerateFeed',
    'chat.messages.remove': 'canModerateChat',
    'chat.messages.restore': 'canModerateChat',
    'chat.conversations.lock': 'canModerateChat',
    'chat.conversations.unlock': 'canModerateChat',
    'chat.conversations.ban': 'canModerateChat',
    'chat.conversations.unban': 'canModerateChat',
    'men.subjects.remove': 'canModerateMen',
    'men.subjects.restore': 'canModerateMen',
    'men.takedowns.approve': 'canModerateMen',
    'men.takedowns.reject': 'canModerateMen',
    
    // System management
    'features.manage': 'canManageFeatures',
    'metrics.view': 'canViewMetrics',
    'exports.create': 'canExportContent',
    'audits.view': 'canViewAudits',
    
    // Report management
    'reports.claim': 'canManageReports',
    'reports.resolve': 'canManageReports',
    'reports.dismiss': 'canManageReports',
    'reports.bulk': 'canBulkActions',
  };
  
  const permission = actionPermissions[action];
  if (!permission) {
    logger.warn('Unknown action requested', { userId, action });
    return false;
  }
  
  return hasPermission(userId, permission, customClaims);
}

/**
 * Get user's effective permissions
 * @param {Object} customClaims - User's custom claims
 * @returns {Object} User's permissions object
 */
function getUserPermissions(customClaims = {}) {
  const role = customClaims.role || 'user';
  return { ...ROLE_PERMISSIONS[role] };
}

/**
 * Validate role transition (e.g., prevent users from promoting themselves to admin)
 * @param {string} currentRole - Current role
 * @param {string} newRole - New role to assign
 * @param {string} actorRole - Role of the user making the change
 * @returns {boolean} Whether transition is valid
 */
function isValidRoleTransition(currentRole, newRole, actorRole) {
  // Only admins can assign admin roles
  if (newRole === 'admin' && actorRole !== 'admin') {
    return false;
  }
  
  // Users cannot promote themselves
  if (currentRole === 'user' && newRole === 'admin') {
    return false;
  }
  
  // Valid role hierarchy
  const validRoles = ['user', 'moderator', 'admin'];
  return validRoles.includes(newRole);
}

module.exports = {
  hasPermission,
  canPerformAction,
  getUserPermissions,
  isValidRoleTransition,
  ROLE_PERMISSIONS,
};
