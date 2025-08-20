const express = require('express');
const { authenticateToken } = require('../../middlewares/auth');
const { requireAdmin, requireModerator, requireSuperAdmin } = require('../../middlewares/rbac');
const { adminIdempotency } = require('../../middlewares/idempotency');
const { adminActionLimiter } = require('../../middlewares/rateLimit');
const { asyncHandler } = require('../../middlewares/error');
const adminController = require('./controller');
const adminValidators = require('./validators');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative and moderation endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminReport:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Report ID
 *         surface:
 *           type: string
 *           enum: [feed, chat, men]
 *           description: Surface where the report originated
 *         entityType:
 *           type: string
 *           enum: [post, comment, message, subject, user]
 *           description: Type of entity being reported
 *         status:
 *           type: string
 *           enum: [new, in_review, resolved, dismissed]
 *           description: Current status of the report
 *         reporterId:
 *           type: string
 *           description: ID of the user who made the report
 *         entityId:
 *           type: string
 *           description: ID of the reported entity
 *         reason:
 *           type: string
 *           description: Reason for the report
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the report was created
 *         claimedBy:
 *           type: string
 *           description: ID of the moderator who claimed the report
 *         claimedAt:
 *           type: string
 *           format: date-time
 *           description: When the report was claimed
 *         resolvedBy:
 *           type: string
 *           description: ID of the moderator who resolved the report
 *         resolvedAt:
 *           type: string
 *           format: date-time
 *           description: When the report was resolved
 *         resolutionCode:
 *           type: string
 *           description: Code indicating how the report was resolved
 *         resolutionNote:
 *           type: string
 *           description: Note from the moderator about the resolution
 *     
 *     AdminUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: User ID
 *         nickname:
 *           type: string
 *           description: User's nickname
 *         email:
 *           type: string
 *           description: User's email address
 *         role:
 *           type: string
 *           enum: [admin, moderator, user]
 *           description: User's role
 *         status:
 *           type: string
 *           enum: [active, suspended]
 *           description: User's account status
 *         isShadowbanned:
 *           type: boolean
 *           description: Whether the user is shadowbanned
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the user account was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the user account was last updated
 *     
 *     AdminFeature:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Feature name
 *         enabled:
 *           type: boolean
 *           description: Whether the feature is enabled
 *         description:
 *           type: string
 *           description: Feature description
 *         category:
 *           type: string
 *           description: Feature category
 *         safe:
 *           type: boolean
 *           description: Whether the feature is safe to toggle
 *     
 *     AdminExportJob:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Export job ID
 *         userId:
 *           type: string
 *           description: ID of the user being exported
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed, cancelled]
 *           description: Current status of the export job
 *         requestedBy:
 *           type: string
 *           description: ID of the admin who requested the export
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the export job was created
 *         completedAt:
 *           type: string
 *           format: date-time
 *           description: When the export job was completed
 *         options:
 *           type: object
 *           description: Export options
 *         result:
 *           type: object
 *           description: Export result (if completed)
 *     
 *     AdminAuditLog:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Audit log ID
 *         actorUserId:
 *           type: string
 *           description: ID of the user who performed the action
 *         action:
 *           type: string
 *           description: Action performed
 *         entity:
 *           type: string
 *           description: Type of entity affected
 *         entityId:
 *           type: string
 *           description: ID of the affected entity
 *         reason:
 *           type: string
 *           description: Reason for the action
 *         metadata:
 *           type: object
 *           description: Additional metadata
 *         ip:
 *           type: string
 *           description: IP address of the actor
 *         userAgent:
 *           type: string
 *           description: User agent of the actor
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the action was performed
 */

// ============================================================================
// REPORTS QUEUES
// ============================================================================

/**
 * @swagger
 * /api/v1/admin/reports:
 *   get:
 *     summary: Get unified reports across all surfaces
 *     tags: [Admin/Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [new, in_review, resolved, dismissed]
 *         description: Filter by report status
 *       - in: query
 *         name: surface
 *         schema:
 *           type: string
 *           enum: [feed, chat, men]
 *         description: Filter by surface
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *           enum: [post, comment, message, subject, user]
 *         description: Filter by entity type
 *       - in: query
 *         name: communityId
 *         schema:
 *           type: string
 *         description: Filter by community ID
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Maximum number of results
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdminReport'
 *                 error:
 *                   type: null
 *                 meta:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *                     nextCursor:
 *                       type: string
 *                     limit:
 *                       type: integer
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get(
  '/reports',
  authenticateToken,
  requireModerator(),
  adminValidators.getUnifiedReportsValidation,
  adminValidators.validate,
  asyncHandler(adminController.getUnifiedReports)
);

/**
 * @swagger
 * /api/v1/admin/reports/{id}/claim:
 *   post:
 *     summary: Claim a report for review
 *     tags: [Admin/Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - surface
 *             properties:
 *               surface:
 *                 type: string
 *                 enum: [feed, chat, men]
 *                 description: Surface where the report originated
 *     responses:
 *       200:
 *         description: Report claimed successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Report not found
 *       409:
 *         description: Report already claimed or not available
 *       500:
 *         description: Internal server error
 */
router.post(
  '/reports/:id/claim',
  authenticateToken,
  requireModerator(),
  adminValidators.claimReportValidation,
  adminValidators.validate,
  asyncHandler(adminController.claimReport)
);

/**
 * @swagger
 * /api/v1/admin/reports/{id}/resolve:
 *   post:
 *     summary: Resolve a report
 *     tags: [Admin/Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - surface
 *               - resolutionCode
 *             properties:
 *               surface:
 *                 type: string
 *                 enum: [feed, chat, men]
 *                 description: Surface where the report originated
 *               resolutionCode:
 *                 type: string
 *                 description: Code indicating how the report was resolved
 *               note:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional note about the resolution
 *     responses:
 *       200:
 *         description: Report resolved successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Report not found
 *       409:
 *         description: Report already resolved or claimed by another moderator
 *       500:
 *         description: Internal server error
 */
router.post(
  '/reports/:id/resolve',
  authenticateToken,
  requireModerator(),
  adminValidators.resolveReportValidation,
  adminValidators.validate,
  asyncHandler(adminController.resolveReport)
);

/**
 * @swagger
 * /api/v1/admin/reports/{id}/dismiss:
 *   post:
 *     summary: Dismiss a report
 *     tags: [Admin/Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - surface
 *             properties:
 *               surface:
 *                 type: string
 *                 enum: [feed, chat, men]
 *                 description: Surface where the report originated
 *               note:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional note about the dismissal
 *     responses:
 *       200:
 *         description: Report dismissed successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Report not found
 *       409:
 *         description: Report already resolved or claimed by another moderator
 *       500:
 *         description: Internal server error
 */
router.post(
  '/reports/:id/dismiss',
  authenticateToken,
  requireModerator(),
  adminValidators.dismissReportValidation,
  adminValidators.validate,
  asyncHandler(adminController.dismissReport)
);

/**
 * @swagger
 * /api/v1/admin/reports/bulk/resolve:
 *   post:
 *     summary: Bulk resolve reports
 *     tags: [Admin/Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reportIds
 *               - surface
 *               - resolutionCode
 *             properties:
 *               reportIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *                 maxItems: 100
 *                 description: Array of report IDs to resolve
 *               surface:
 *                 type: string
 *                 enum: [feed, chat, men]
 *                 description: Surface where the reports originated
 *               resolutionCode:
 *                 type: string
 *                 description: Code indicating how the reports were resolved
 *               note:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional note about the resolution
 *     responses:
 *       200:
 *         description: Reports resolved successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post(
  '/reports/bulk/resolve',
  authenticateToken,
  requireModerator(),
  adminValidators.bulkResolveReportsValidation,
  adminValidators.validate,
  asyncHandler(adminController.bulkResolveReports)
);

/**
 * @swagger
 * /api/v1/admin/reports/bulk/dismiss:
 *   post:
 *     summary: Bulk dismiss reports
 *     tags: [Admin/Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reportIds
 *               - surface
 *             properties:
 *               reportIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *                 maxItems: 100
 *                 description: Array of report IDs to dismiss
 *               surface:
 *                 type: string
 *                 enum: [feed, chat, men]
 *                 description: Surface where the reports originated
 *               note:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional note about the dismissal
 *     responses:
 *       200:
 *         description: Reports dismissed successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post(
  '/reports/bulk/dismiss',
  authenticateToken,
  requireModerator(),
  adminValidators.bulkDismissReportsValidation,
  adminValidators.validate,
  asyncHandler(adminController.bulkDismissReports)
);

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * @swagger
 * /api/v1/admin/users/{uid}/role:
 *   post:
 *     summary: Set user role (admin only)
 *     tags: [Admin/Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, moderator, user]
 *                 description: New role to assign
 *     responses:
 *       200:
 *         description: User role updated successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 *       409:
 *         description: User already has this role
 *       500:
 *         description: Internal server error
 */
router.post(
  '/users/:uid/role',
  authenticateToken,
  requireAdmin(),
  adminIdempotency,
  adminValidators.setUserRoleValidation,
  adminValidators.validate,
  asyncHandler(adminController.setUserRole)
);

/**
 * @swagger
 * /api/v1/admin/users/{uid}/ban:
 *   post:
 *     summary: Ban a user
 *     tags: [Admin/Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Reason for the ban
 *               until:
 *                 type: string
 *                 format: date-time
 *                 description: Ban expiration date (optional, permanent if not provided)
 *     responses:
 *       200:
 *         description: User banned successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       409:
 *         description: User already suspended
 *       500:
 *         description: Internal server error
 */
router.post(
  '/users/:uid/ban',
  authenticateToken,
  requireModerator(),
  adminIdempotency,
  adminValidators.banUserValidation,
  adminValidators.validate,
  asyncHandler(adminController.banUser)
);

/**
 * @swagger
 * /api/v1/admin/users/{uid}/unban:
 *   post:
 *     summary: Unban a user
 *     tags: [Admin/Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User unbanned successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       409:
 *         description: User is not suspended
 *       500:
 *         description: Internal server error
 */
router.post(
  '/users/:uid/unban',
  authenticateToken,
  requireModerator(),
  adminIdempotency,
  adminValidators.unbanUserValidation,
  adminValidators.validate,
  asyncHandler(adminController.unbanUser)
);

/**
 * @swagger
 * /api/v1/admin/users/{uid}/shadowban:
 *   post:
 *     summary: Shadowban a user
 *     tags: [Admin/Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Reason for the shadowban
 *     responses:
 *       200:
 *         description: User shadowbanned successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       409:
 *         description: User already shadowbanned
 *       500:
 *         description: Internal server error
 */
router.post(
  '/users/:uid/shadowban',
  authenticateToken,
  requireModerator(),
  adminValidators.shadowbanUserValidation,
  adminValidators.validate,
  asyncHandler(adminController.shadowbanUser)
);

/**
 * @swagger
 * /api/v1/admin/users/{uid}/unshadowban:
 *   post:
 *     summary: Remove shadowban from user
 *     tags: [Admin/Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Shadowban removed successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       409:
 *         description: User is not shadowbanned
 *       500:
 *         description: Internal server error
 */
router.post(
  '/users/:uid/unshadowban',
  authenticateToken,
  requireModerator(),
  adminValidators.unshadowbanUserValidation,
  adminValidators.validate,
  asyncHandler(adminController.unshadowbanUser)
);

/**
 * @swagger
 * /api/v1/admin/users/{uid}/logout-all:
 *   post:
 *     summary: Logout all user sessions (admin only)
 *     tags: [Admin/Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: All user sessions logged out successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/users/:uid/logout-all',
  authenticateToken,
  requireAdmin(),
  adminValidators.logoutAllUserSessionsValidation,
  adminValidators.validate,
  asyncHandler(adminController.logoutAllUserSessions)
);

/**
 * @swagger
 * /api/v1/admin/users/search:
 *   get:
 *     summary: Search users
 *     tags: [Admin/Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query (nickname/email)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, suspended]
 *         description: Filter by status
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, moderator, user]
 *         description: Filter by role
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Maximum number of results
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdminUser'
 *                 error:
 *                   type: null
 *                 meta:
 *                   type: object
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get(
  '/users/search',
  authenticateToken,
  requireModerator(),
  adminValidators.searchUsersValidation,
  adminValidators.validate,
  asyncHandler(adminController.searchUsers)
);

/**
 * @swagger
 * /api/v1/admin/users/{uid}:
 *   get:
 *     summary: Get user details
 *     tags: [Admin/Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/users/:uid',
  authenticateToken,
  requireModerator(),
  adminValidators.getUserDetailsValidation,
  adminValidators.validate,
  asyncHandler(adminController.getUserDetails)
);

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/**
 * @swagger
 * /api/v1/admin/system/features:
 *   get:
 *     summary: Get feature flags
 *     tags: [Admin/System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feature flags retrieved successfully
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get(
  '/system/features',
  authenticateToken,
  requireAdmin(),
  adminValidators.getFeaturesValidation,
  adminValidators.validate,
  asyncHandler(adminController.getFeatures)
);

/**
 * @swagger
 * /api/v1/admin/system/features:
 *   patch:
 *     summary: Update feature flags (admin only)
 *     tags: [Admin/System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updates
 *             properties:
 *               updates:
 *                 type: object
 *                 additionalProperties:
 *                   type: boolean
 *                 description: Feature updates (feature name -> boolean value)
 *     responses:
 *       200:
 *         description: Features updated successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.patch(
  '/system/features',
  authenticateToken,
  requireAdmin(),
  adminValidators.updateFeaturesValidation,
  adminValidators.validate,
  asyncHandler(adminController.updateFeatures)
);

// ============================================================================
// CONTENT EXPORTS
// ============================================================================

/**
 * @swagger
 * /api/v1/admin/export/users/{uid}:
 *   post:
 *     summary: Create content export job for a user
 *     tags: [Admin/Exports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to export content for
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               options:
 *                 type: object
 *                 properties:
 *                   includePosts:
 *                     type: boolean
 *                     default: true
 *                   includeComments:
 *                     type: boolean
 *                     default: true
 *                   includeMessages:
 *                     type: boolean
 *                     default: true
 *                   includeMenSubjects:
 *                     type: boolean
 *                     default: true
 *                   includeReports:
 *                     type: boolean
 *                     default: true
 *     responses:
 *       200:
 *         description: Export job created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/export/users/:uid',
  authenticateToken,
  requireModerator(),
  adminValidators.createExportJobValidation,
  adminValidators.validate,
  asyncHandler(adminController.createExportJob)
);

/**
 * @swagger
 * /api/v1/admin/export/jobs/{jobId}:
 *   get:
 *     summary: Get export job status
 *     tags: [Admin/Exports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Export job ID
 *     responses:
 *       200:
 *         description: Export job details retrieved successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Export job not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/export/jobs/:jobId',
  authenticateToken,
  requireModerator(),
  adminValidators.getExportJobValidation,
  adminValidators.validate,
  asyncHandler(adminController.getExportJob)
);

// ============================================================================
// AUDIT LOGS
// ============================================================================

/**
 * @swagger
 * /api/v1/admin/audits:
 *   get:
 *     summary: Get audit logs
 *     tags: [Admin/Audits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: actorId
 *         schema:
 *           type: string
 *         description: Filter by actor user ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *         description: Filter by entity type
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Maximum number of results
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdminAuditLog'
 *                 error:
 *                   type: null
 *                 meta:
 *                   type: object
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get(
  '/audits',
  authenticateToken,
  requireModerator(),
  adminValidators.getAuditLogsValidation,
  adminValidators.validate,
  asyncHandler(adminController.getAuditLogs)
);

module.exports = router;
