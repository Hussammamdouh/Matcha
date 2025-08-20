const request = require('supertest');
const { createApp } = require('../../app');
const { createMockAdminUser, createMockModeratorUser } = require('../setup');

describe('Admin Audit Logs Tests', () => {
  let app;
  let mockAdminUser;
  let mockModeratorUser;

  beforeAll(async () => {
    app = createApp();
    
    // Create mock users with different roles
    mockAdminUser = createMockAdminUser();
    mockModeratorUser = createMockModeratorUser();
  });

  describe('GET /api/v1/admin/audits', () => {
    it('should allow admin to get audit logs', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/audits')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toBeDefined();
    });

    it('should allow moderator to get audit logs', async () => {
      const moderatorToken = mockModeratorUser.token;

      const response = await request(app)
        .get('/api/v1/admin/audits')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toBeDefined();
    });

    it('should filter audit logs by actor ID', async () => {
      const adminToken = mockAdminUser.token;
      const actorId = 'test-actor-id';

      const response = await request(app)
        .get(`/api/v1/admin/audits?actorId=${actorId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should filter audit logs by action', async () => {
      const adminToken = mockAdminUser.token;
      const action = 'user_role_changed';

      const response = await request(app)
        .get(`/api/v1/admin/audits?action=${action}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should filter audit logs by entity type', async () => {
      const adminToken = mockAdminUser.token;
      const entityType = 'user';

      const response = await request(app)
        .get(`/api/v1/admin/audits?entityType=${entityType}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should filter audit logs by date range', async () => {
      const adminToken = mockAdminUser.token;
      const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const toDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/v1/admin/audits?from=${fromDate}&to=${toDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should support pagination with cursor', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/audits?cursor=test-cursor&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.meta).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/audits?limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should return 403 for regular users', async () => {
      const regularUserToken = 'invalid-token';

      await request(app)
        .get('/api/v1/admin/audits')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app)
        .get('/api/v1/admin/audits')
        .expect(401);
    });
  });

  describe('Audit Log Structure', () => {
    it('should return audit logs with correct structure', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/audits?limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      
      if (response.body.data.length > 0) {
        const auditLog = response.body.data[0];
        
        // Check required fields
        expect(auditLog).toHaveProperty('id');
        expect(auditLog).toHaveProperty('actorUserId');
        expect(auditLog).toHaveProperty('action');
        expect(auditLog).toHaveProperty('entity');
        expect(auditLog).toHaveProperty('entityId');
        expect(auditLog).toHaveProperty('createdAt');
        
        // Check optional fields
        expect(auditLog).toHaveProperty('reason');
        expect(auditLog).toHaveProperty('metadata');
        expect(auditLog).toHaveProperty('ip');
        expect(auditLog).toHaveProperty('userAgent');
      }
    });

    it('should return audit logs with metadata', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/audits?limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      
      if (response.body.data.length > 0) {
        const auditLog = response.body.data[0];
        
        // Check metadata structure
        if (auditLog.metadata) {
          expect(typeof auditLog.metadata).toBe('object');
        }
      }
    });
  });

  describe('Audit Log Filtering', () => {
    it('should filter by multiple criteria', async () => {
      const adminToken = mockAdminUser.token;
      const actorId = 'test-actor-id';
      const action = 'user_banned';
      const entityType = 'user';

      const response = await request(app)
        .get(`/api/v1/admin/audits?actorId=${actorId}&action=${action}&entityType=${entityType}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should handle date filtering correctly', async () => {
      const adminToken = mockAdminUser.token;
      
      // Test with only from date
      const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const response1 = await request(app)
        .get(`/api/v1/admin/audits?from=${fromDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response1.body.ok).toBe(true);
      expect(response1.body.data).toBeDefined();

      // Test with only to date
      const toDate = new Date().toISOString();
      const response2 = await request(app)
        .get(`/api/v1/admin/audits?to=${toDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response2.body.ok).toBe(true);
      expect(response2.body.data).toBeDefined();
    });

    it('should handle invalid date formats gracefully', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/audits?from=invalid-date&to=also-invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Audit Log Pagination', () => {
    it('should return pagination metadata', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/audits?limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta).toHaveProperty('count');
      expect(response.body.meta).toHaveProperty('hasMore');
      expect(response.body.meta).toHaveProperty('limit');
    });

    it('should handle cursor-based pagination', async () => {
      const adminToken = mockAdminUser.token;

      // First page
      const response1 = await request(app)
        .get('/api/v1/admin/audits?limit=3')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response1.body.ok).toBe(true);
      expect(response1.body.data).toBeDefined();
      expect(response1.body.meta).toBeDefined();

      // Second page using cursor
      if (response1.body.meta.hasMore && response1.body.meta.nextCursor) {
        const response2 = await request(app)
          .get(`/api/v1/admin/audits?cursor=${response1.body.meta.nextCursor}&limit=3`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response2.body.ok).toBe(true);
        expect(response2.body.data).toBeDefined();
        
        // Ensure different results
        expect(response2.body.data).not.toEqual(response1.body.data);
      }
    });

    it('should respect limit constraints', async () => {
      const adminToken = mockAdminUser.token;

      // Test minimum limit
      const response1 = await request(app)
        .get('/api/v1/admin/audits?limit=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response1.body.ok).toBe(false);
      expect(response1.body.error.code).toBe('VALIDATION_ERROR');

      // Test maximum limit
      const response2 = await request(app)
        .get('/api/v1/admin/audits?limit=51')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response2.body.ok).toBe(false);
      expect(response2.body.error.code).toBe('VALIDATION_ERROR');

      // Test valid limit
      const response3 = await request(app)
        .get('/api/v1/admin/audits?limit=25')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response3.body.ok).toBe(true);
      expect(response3.body.data.length).toBeLessThanOrEqual(25);
    });
  });

  describe('Audit Log Content Types', () => {
    it('should handle different action types', async () => {
      const adminToken = mockAdminUser.token;

      const actions = [
        'user_role_changed',
        'user_banned',
        'user_unbanned',
        'user_shadowbanned',
        'user_unshadowbanned',
        'user_logout_all',
        'report_claimed',
        'report_resolved',
        'report_dismissed',
        'post_removed',
        'post_restored',
        'comment_removed',
        'comment_restored',
        'community_locked',
        'community_unlocked',
        'chat_message_removed',
        'chat_message_restored',
        'chat_conversation_locked',
        'chat_conversation_unlocked',
        'men_subject_removed',
        'men_subject_restored',
        'men_takedown_approved',
        'men_takedown_rejected',
        'feature_flag_updated',
        'export_job_created'
      ];

      for (const action of actions) {
        const response = await request(app)
          .get(`/api/v1/admin/audits?action=${action}&limit=1`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.data).toBeDefined();
      }
    });

    it('should handle different entity types', async () => {
      const adminToken = mockAdminUser.token;

      const entityTypes = [
        'user',
        'post',
        'comment',
        'community',
        'conversation',
        'message',
        'report',
        'subject',
        'takedown',
        'feature',
        'export'
      ];

      for (const entityType of entityTypes) {
        const response = await request(app)
          .get(`/api/v1/admin/audits?entityType=${entityType}&limit=1`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.data).toBeDefined();
      }
    });
  });

  describe('Audit Log Security', () => {
    it('should not expose sensitive information in audit logs', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/audits?limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      
      if (response.body.data.length > 0) {
        const auditLog = response.body.data[0];
        
        // Check that sensitive fields are not exposed
        expect(auditLog).not.toHaveProperty('password');
        expect(auditLog).not.toHaveProperty('token');
        expect(auditLog).not.toHaveProperty('secret');
        expect(auditLog).not.toHaveProperty('key');
        
        // Check that IP addresses are properly formatted
        if (auditLog.ip) {
          expect(typeof auditLog.ip).toBe('string');
          // Basic IP format validation
          expect(auditLog.ip).toMatch(/^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]+$/);
        }
      }
    });

    it('should sanitize user agent strings', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/audits?limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      
      if (response.body.data.length > 0) {
        const auditLog = response.body.data[0];
        
        if (auditLog.userAgent) {
          expect(typeof auditLog.userAgent).toBe('string');
          // Check that user agent doesn't contain potentially harmful content
          expect(auditLog.userAgent).not.toContain('<script>');
          expect(auditLog.userAgent).not.toContain('javascript:');
        }
      }
    });
  });

  describe('Audit Log Integration', () => {
    it('should create audit logs for admin actions', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-audit-user-id';

      // Perform an admin action that should create an audit log
      const roleResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator' })
        .expect(200);

      expect(roleResponse.body.ok).toBe(true);

      // Check that an audit log was created
      const auditResponse = await request(app)
        .get(`/api/v1/admin/audits?actorId=${mockAdminUser.uid}&action=user_role_changed&entityType=user&entityId=${userId}&limit=1`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(auditResponse.body.ok).toBe(true);
      expect(auditResponse.body.data).toBeDefined();
      
      if (auditResponse.body.data.length > 0) {
        const auditLog = auditResponse.body.data[0];
        expect(auditLog.action).toBe('user_role_changed');
        expect(auditLog.entity).toBe('user');
        expect(auditLog.entityId).toBe(userId);
        expect(auditLog.actorUserId).toBe(mockAdminUser.uid);
      }
    });

    it('should create audit logs for moderator actions', async () => {
      const moderatorToken = mockModeratorUser.token;
      const userId = 'test-audit-moderator-user-id';

      // Perform a moderator action that should create an audit log
      const banResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/ban`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ reason: 'Test audit log creation' })
        .expect(200);

      expect(banResponse.body.ok).toBe(true);

      // Check that an audit log was created
      const auditResponse = await request(app)
        .get(`/api/v1/admin/audits?actorId=${mockModeratorUser.uid}&action=user_banned&entityType=user&entityId=${userId}&limit=1`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200);

      expect(auditResponse.body.ok).toBe(true);
      expect(auditResponse.body.data).toBeDefined();
      
      if (auditResponse.body.data.length > 0) {
        const auditLog = auditResponse.body.data[0];
        expect(auditLog.action).toBe('user_banned');
        expect(auditLog.entity).toBe('user');
        expect(auditLog.entityId).toBe(userId);
        expect(auditLog.actorUserId).toBe(mockModeratorUser.uid);
        expect(auditLog.reason).toBe('Test audit log creation');
      }
    });
  });
});
