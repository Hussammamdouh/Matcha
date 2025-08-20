const { createModuleLogger } = require('../../lib/logger');
const { canPerformAction } = require('./rbac');
const auditsService = require('./audits.service');
const queuesService = require('./queues.service');
const moderationService = require('./moderation.service');
const usersService = require('./users.service');
const featuresService = require('./features.service');
const exportsService = require('./exports.service');

const logger = createModuleLogger('admin:controller');

/**
 * Get unified reports across all surfaces
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getUnifiedReports(req, res) {
  try {
    const { status, surface, entityType, communityId, from, to, cursor, limit } = req.query;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'reports.claim', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to view reports',
        },
      });
    }
    
    // Parse date filters
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    
    const result = await queuesService.getUnifiedReports({
      status,
      surface,
      entityType,
      communityId,
      from: fromDate,
      to: toDate,
      cursor,
      limit: parseInt(limit) || 20,
    });
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'reports.view',
      entity: 'reports',
      entityId: 'unified',
      reason: null,
      metadata: { status, surface, entityType, communityId, from, to },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    res.json({
      ok: true,
      data: result.data,
      error: null,
      meta: {
        ...result.meta,
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Failed to get unified reports', {
      error: error.message,
      adminId: req.user.uid,
    });
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to retrieve reports',
      },
    });
  }
}

/**
 * Claim a report for review
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function claimReport(req, res) {
  try {
    const { id } = req.params;
    const { surface } = req.body;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'reports.claim', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to claim reports',
        },
      });
    }
    
    // Check idempotency
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      const existingAction = await auditsService.checkIdempotency(
        adminId,
        'reports.claim',
        'report',
        id,
        idempotencyKey
      );
      
      if (existingAction) {
        return res.status(409).json({
          ok: false,
          error: {
            code: 'IDEMPOTENT_REPLAY',
            message: 'This action has already been performed',
            existingActionId: existingAction.id,
          },
        });
      }
    }
    
    const result = await queuesService.claimReport(id, surface, adminId);
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'reports.claim',
      entity: 'report',
      entityId: id,
      reason: null,
      metadata: { surface, reportId: id },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      idempotencyKey,
    });
    
    res.json({
      ok: true,
      data: result,
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to claim report', {
      error: error.message,
      reportId: req.params.id,
      adminId: req.user.uid,
    });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Report not found',
        },
      });
    }
    
    if (error.message.includes('already claimed') || error.message.includes('not available')) {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'CONFLICT',
          message: error.message,
        },
      });
    }
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to claim report',
      },
    });
  }
}

/**
 * Resolve a report
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function resolveReport(req, res) {
  try {
    const { id } = req.params;
    const { surface, resolutionCode, note } = req.body;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'reports.resolve', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to resolve reports',
        },
      });
    }
    
    // Check idempotency
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      const existingAction = await auditsService.checkIdempotency(
        adminId,
        'reports.resolve',
        'report',
        id,
        idempotencyKey
      );
      
      if (existingAction) {
        return res.status(409).json({
          ok: false,
          error: {
            code: 'IDEMPOTENT_REPLAY',
            message: 'This action has already been performed',
            existingActionId: existingAction.id,
          },
        });
      }
    }
    
    const result = await queuesService.resolveReport(id, surface, adminId, resolutionCode, note);
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'reports.resolve',
      entity: 'report',
      entityId: id,
      reason: note,
      metadata: { surface, resolutionCode, reportId: id },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      idempotencyKey,
    });
    
    res.json({
      ok: true,
      data: result,
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to resolve report', {
      error: error.message,
      reportId: req.params.id,
      adminId: req.user.uid,
    });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Report not found',
        },
      });
    }
    
    if (error.message.includes('already resolved') || error.message.includes('claimed by another')) {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'CONFLICT',
          message: error.message,
        },
      });
    }
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to resolve report',
      },
    });
  }
}

/**
 * Dismiss a report
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function dismissReport(req, res) {
  try {
    const { id } = req.params;
    const { surface, note } = req.body;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'reports.dismiss', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to dismiss reports',
        },
      });
    }
    
    // Check idempotency
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      const existingAction = await auditsService.checkIdempotency(
        adminId,
        'reports.dismiss',
        'report',
        id,
        idempotencyKey
      );
      
      if (existingAction) {
        return res.status(409).json({
          ok: false,
          error: {
            code: 'IDEMPOTENT_REPLAY',
            message: 'This action has already been performed',
            existingActionId: existingAction.id,
          },
        });
      }
    }
    
    const result = await queuesService.dismissReport(id, surface, adminId, note);
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'reports.dismiss',
      entity: 'report',
      entityId: id,
      reason: note,
      metadata: { surface, reportId: id },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      idempotencyKey,
    });
    
    res.json({
      ok: true,
      data: result,
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to dismiss report', {
      error: error.message,
      reportId: req.params.id,
      adminId: req.user.uid,
    });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Report not found',
        },
      });
    }
    
    if (error.message.includes('already resolved') || error.message.includes('claimed by another')) {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'CONFLICT',
          message: error.message,
        },
      });
    }
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to dismiss report',
      },
    });
  }
}

/**
 * Bulk resolve reports
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function bulkResolveReports(req, res) {
  try {
    const { reportIds, surface, resolutionCode, note } = req.body;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'reports.bulk', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to perform bulk actions',
        },
      });
    }
    
    // Check idempotency
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      const existingAction = await auditsService.checkIdempotency(
        adminId,
        'reports.bulk.resolve',
        'reports',
        'bulk',
        idempotencyKey
      );
      
      if (existingAction) {
        return res.status(409).json({
          ok: false,
          error: {
            code: 'IDEMPOTENT_REPLAY',
            message: 'This action has already been performed',
            existingActionId: existingAction.id,
          },
        });
      }
    }
    
    const result = await queuesService.bulkResolveReports(reportIds, surface, adminId, resolutionCode, note);
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'reports.bulk.resolve',
      entity: 'reports',
      entityId: 'bulk',
      reason: note,
      metadata: { 
        surface, 
        resolutionCode, 
        reportIds, 
        successful: result.summary.successful,
        failed: result.summary.failed 
      },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      idempotencyKey,
    });
    
    res.json({
      ok: true,
      data: result,
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to bulk resolve reports', {
      error: error.message,
      adminId: req.user.uid,
    });
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to bulk resolve reports',
      },
    });
  }
}

/**
 * Bulk dismiss reports
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function bulkDismissReports(req, res) {
  try {
    const { reportIds, surface, note } = req.body;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'reports.bulk', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to perform bulk actions',
        },
      });
    }
    
    // Check idempotency
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      const existingAction = await auditsService.checkIdempotency(
        adminId,
        'reports.bulk.dismiss',
        'reports',
        'bulk',
        idempotencyKey
      );
      
      if (existingAction) {
        return res.status(409).json({
          ok: false,
          error: {
            code: 'IDEMPOTENT_REPLAY',
            message: 'This action has already been performed',
            existingActionId: existingAction.id,
          },
        });
      }
    }
    
    const result = await queuesService.bulkDismissReports(reportIds, surface, adminId, note);
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'reports.bulk.dismiss',
      entity: 'reports',
      entityId: 'bulk',
      reason: note,
      metadata: { 
        surface, 
        reportIds, 
        successful: result.summary.successful,
        failed: result.summary.failed 
      },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      idempotencyKey,
    });
    
    res.json({
      ok: true,
      data: result,
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to bulk dismiss reports', {
      error: error.message,
      adminId: req.user.uid,
    });
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to bulk dismiss reports',
      },
    });
  }
}

/**
 * Set user role (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function setUserRole(req, res) {
  try {
    const { uid } = req.params;
    const { role } = req.body;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'users.setRole', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to manage user roles',
        },
      });
    }
    
    // Check idempotency
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      const existingAction = await auditsService.checkIdempotency(
        adminId,
        'users.setRole',
        'user',
        uid,
        idempotencyKey
      );
      
      if (existingAction) {
        return res.status(409).json({
          ok: false,
          error: {
            code: 'IDEMPOTENT_REPLAY',
            message: 'This action has already been performed',
            existingActionId: existingAction.id,
          },
        });
      }
    }
    
    const result = await usersService.setUserRole(uid, role, adminId);
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'users.setRole',
      entity: 'user',
      entityId: uid,
      reason: null,
      metadata: { 
        oldRole: result.oldRole, 
        newRole: result.newRole,
        targetUserId: uid 
      },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      idempotencyKey,
    });
    
    res.json({
      ok: true,
      data: result,
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to set user role', {
      error: error.message,
      userId: req.params.uid,
      adminId: req.user.uid,
    });
    
    if (error.message.includes('Invalid role')) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      });
    }
    
    if (error.message.includes('already has this role')) {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'CONFLICT',
          message: error.message,
        },
      });
    }
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to set user role',
      },
    });
  }
}

/**
 * Ban a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function banUser(req, res) {
  try {
    const { uid } = req.params;
    const { reason, until } = req.body;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'users.ban', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to ban users',
        },
      });
    }
    
    // Check idempotency
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      const existingAction = await auditsService.checkIdempotency(
        adminId,
        'users.ban',
        'user',
        uid,
        idempotencyKey
      );
      
      if (existingAction) {
        return res.status(409).json({
          ok: false,
          error: {
            code: 'IDEMPOTENT_REPLAY',
            message: 'This action has already been performed',
            existingActionId: existingAction.id,
          },
        });
      }
    }
    
    const untilDate = until ? new Date(until) : null;
    const result = await usersService.banUser(uid, adminId, reason, untilDate);
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'users.ban',
      entity: 'user',
      entityId: uid,
      reason,
      metadata: { 
        targetUserId: uid,
        until: untilDate,
        reason 
      },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      idempotencyKey,
    });
    
    res.json({
      ok: true,
      data: result,
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to ban user', {
      error: error.message,
      userId: req.params.uid,
      adminId: req.user.uid,
    });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }
    
    if (error.message.includes('already suspended')) {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'CONFLICT',
          message: error.message,
        },
      });
    }
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to ban user',
      },
    });
  }
}

/**
 * Unban a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function unbanUser(req, res) {
  try {
    const { uid } = req.params;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'users.ban', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to unban users',
        },
      });
    }
    
    // Check idempotency
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      const existingAction = await auditsService.checkIdempotency(
        adminId,
        'users.unban',
        'user',
        uid,
        idempotencyKey
      );
      
      if (existingAction) {
        return res.status(409).json({
          ok: false,
          error: {
            code: 'IDEMPOTENT_REPLAY',
            message: 'This action has already been performed',
            existingActionId: existingAction.id,
          },
        });
      }
    }
    
    const result = await usersService.unbanUser(uid, adminId);
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'users.unban',
      entity: 'user',
      entityId: uid,
      reason: null,
      metadata: { targetUserId: uid },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      idempotencyKey,
    });
    
    res.json({
      ok: true,
      data: result,
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to unban user', {
      error: error.message,
      userId: req.params.uid,
      adminId: req.user.uid,
    });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }
    
    if (error.message.includes('not suspended')) {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'CONFLICT',
          message: error.message,
        },
      });
    }
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to unban user',
      },
    });
  }
}

/**
 * Shadowban a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function shadowbanUser(req, res) {
  try {
    const { uid } = req.params;
    const { reason } = req.body;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'users.shadowban', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to shadowban users',
        },
      });
    }
    
    // Check idempotency
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      const existingAction = await auditsService.checkIdempotency(
        adminId,
        'users.shadowban',
        'user',
        uid,
        idempotencyKey
      );
      
      if (existingAction) {
        return res.status(409).json({
          ok: false,
          error: {
            code: 'IDEMPOTENT_REPLAY',
            message: 'This action has already been performed',
            existingActionId: existingAction.id,
          },
        });
      }
    }
    
    const result = await usersService.shadowbanUser(uid, adminId, reason);
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'users.shadowban',
      entity: 'user',
      entityId: uid,
      reason,
      metadata: { targetUserId: uid, reason },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      idempotencyKey,
    });
    
    res.json({
      ok: true,
      data: result,
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to shadowban user', {
      error: error.message,
      userId: req.params.uid,
      adminId: req.user.uid,
    });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }
    
    if (error.message.includes('already shadowbanned')) {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'CONFLICT',
          message: error.message,
        },
      });
    }
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to shadowban user',
      },
    });
  }
}

/**
 * Remove shadowban from user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function unshadowbanUser(req, res) {
  try {
    const { uid } = req.params;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'users.shadowban', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to remove shadowban',
        },
      });
    }
    
    // Check idempotency
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      const existingAction = await auditsService.checkIdempotency(
        adminId,
        'users.unshadowban',
        'user',
        uid,
        idempotencyKey
      );
      
      if (existingAction) {
        return res.status(409).json({
          ok: false,
          error: {
            code: 'IDEMPOTENT_REPLAY',
            message: 'This action has already been performed',
            existingActionId: existingAction.id,
          },
        });
      }
    }
    
    const result = await usersService.unshadowbanUser(uid, adminId);
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'users.unshadowban',
      entity: 'user',
      entityId: uid,
      reason: null,
      metadata: { targetUserId: uid },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      idempotencyKey,
    });
    
    res.json({
      ok: true,
      data: result,
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to remove shadowban from user', {
      error: error.message,
      userId: req.params.uid,
      adminId: req.user.uid,
    });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }
    
    if (error.message.includes('not shadowbanned')) {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'CONFLICT',
          message: error.message,
        },
      });
    }
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to remove shadowban from user',
      },
    });
  }
}

/**
 * Logout all user sessions (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function logoutAllUserSessions(req, res) {
  try {
    const { uid } = req.params;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'users.logoutAll', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to logout users',
        },
      });
    }
    
    // Check idempotency
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      const existingAction = await auditsService.checkIdempotency(
        adminId,
        'users.logoutAll',
        'user',
        uid,
        idempotencyKey
      );
      
      if (existingAction) {
        return res.status(409).json({
          ok: false,
          error: {
            code: 'IDEMPOTENT_REPLAY',
            message: 'This action has already been performed',
            existingActionId: existingAction.id,
          },
        });
      }
    }
    
    const result = await usersService.logoutAllUserSessions(uid, adminId);
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'users.logoutAll',
      entity: 'user',
      entityId: uid,
      reason: null,
      metadata: { targetUserId: uid },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      idempotencyKey,
    });
    
    res.json({
      ok: true,
      data: result,
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to logout all user sessions', {
      error: error.message,
      userId: req.params.uid,
      adminId: req.user.uid,
    });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to logout user sessions',
      },
    });
  }
}

/**
 * Search users
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function searchUsers(req, res) {
  try {
    const { q, status, role, cursor, limit } = req.query;
    const adminId = req.user.uid;
    
    // Check permissions (basic user viewing)
    if (!canPerformAction(adminId, 'users.ban', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to search users',
        },
      });
    }
    
    const result = await usersService.searchUsers({
      q,
      status,
      role,
      cursor,
      limit: parseInt(limit) || 20,
    });
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'users.search',
      entity: 'users',
      entityId: 'search',
      reason: null,
      metadata: { q, status, role, resultCount: result.data.length },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    res.json({
      ok: true,
      data: result.data,
      error: null,
      meta: {
        ...result.meta,
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Failed to search users', {
      error: error.message,
      adminId: req.user.uid,
    });
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to search users',
      },
    });
  }
}

/**
 * Get user details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getUserDetails(req, res) {
  try {
    const { uid } = req.params;
    const adminId = req.user.uid;
    
    // Check permissions (basic user viewing)
    if (!canPerformAction(adminId, 'users.ban', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to view user details',
        },
      });
    }
    
    const userDetails = await usersService.getUserDetails(uid);
    
    if (!userDetails) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'users.view',
      entity: 'user',
      entityId: uid,
      reason: null,
      metadata: { targetUserId: uid },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    res.json({
      ok: true,
      data: userDetails,
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to get user details', {
      error: error.message,
      userId: req.params.uid,
      adminId: req.user.uid,
    });
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to get user details',
      },
    });
  }
}

/**
 * Get feature flags
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getFeatures(req, res) {
  try {
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'features.manage', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to view features',
        },
      });
    }
    
    const features = featuresService.getFeatures();
    const metadata = featuresService.getFeatureMetadata();
    
    res.json({
      ok: true,
      data: {
        features,
        metadata,
      },
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to get features', {
      error: error.message,
      adminId: req.user.uid,
    });
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to get features',
      },
    });
  }
}

/**
 * Update feature flags
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateFeatures(req, res) {
  try {
    const { updates } = req.body;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'features.manage', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to update features',
        },
      });
    }
    
    // Validate updates
    const validation = featuresService.validateFeatureUpdates(updates);
    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid feature updates',
          fields: validation.errors,
        },
      });
    }
    
    const result = await featuresService.updateFeatures(updates, adminId);
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'features.update',
      entity: 'features',
      entityId: 'bulk',
      reason: null,
      metadata: { 
        updates: Object.keys(updates),
        updatedFeatures: result.updated 
      },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    res.json({
      ok: true,
      data: result,
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to update features', {
      error: error.message,
      adminId: req.user.uid,
    });
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to update features',
      },
    });
  }
}

/**
 * Create content export job
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createExportJob(req, res) {
  try {
    const { uid } = req.params;
    const { options } = req.body;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'exports.create', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to create exports',
        },
      });
    }
    
    const result = await exportsService.createExportJob(uid, adminId, options);
    
    // Audit the action
    await auditsService.createAuditLog({
      actorUserId: adminId,
      action: 'exports.create',
      entity: 'export',
      entityId: result.jobId,
      reason: null,
      metadata: { 
        targetUserId: uid,
        options,
        jobId: result.jobId 
      },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    res.json({
      ok: true,
      data: result,
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to create export job', {
      error: error.message,
      userId: req.params.uid,
      adminId: req.user.uid,
    });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to create export job',
      },
    });
  }
}

/**
 * Get export job status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getExportJob(req, res) {
  try {
    const { jobId } = req.params;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'exports.create', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to view exports',
        },
      });
    }
    
    const exportJob = await exportsService.getExportJob(jobId);
    
    if (!exportJob) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Export job not found',
        },
      });
    }
    
    res.json({
      ok: true,
      data: exportJob,
      error: null,
      meta: { requestId: req.id },
    });
  } catch (error) {
    logger.error('Failed to get export job', {
      error: error.message,
      jobId: req.params.jobId,
      adminId: req.user.uid,
    });
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to get export job',
      },
    });
  }
}

/**
 * Get audit logs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getAuditLogs(req, res) {
  try {
    const { actorId, action, entityType, from, to, cursor, limit } = req.query;
    const adminId = req.user.uid;
    
    // Check permissions
    if (!canPerformAction(adminId, 'audits.view', req.user.customClaims)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to view audit logs',
        },
      });
    }
    
    // Parse date filters
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    
    const result = await auditsService.getAuditLogs({
      actorId,
      action,
      entityType,
      from: fromDate,
      to: toDate,
      cursor,
      limit: parseInt(limit) || 20,
    });
    
    res.json({
      ok: true,
      data: result.data,
      error: null,
      meta: {
        ...result.meta,
        requestId: req.id,
      },
    });
  } catch (error) {
    logger.error('Failed to get audit logs', {
      error: error.message,
      adminId: req.user.uid,
    });
    
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to get audit logs',
      },
    });
  }
}

module.exports = {
  // Reports
  getUnifiedReports,
  claimReport,
  resolveReport,
  dismissReport,
  bulkResolveReports,
  bulkDismissReports,
  
  // Users
  setUserRole,
  banUser,
  unbanUser,
  shadowbanUser,
  unshadowbanUser,
  logoutAllUserSessions,
  searchUsers,
  getUserDetails,
  
  // Features
  getFeatures,
  updateFeatures,
  
  // Exports
  createExportJob,
  getExportJob,
  
  // Audits
  getAuditLogs,
};
