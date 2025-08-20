const request = require('supertest');
const { createApp } = require('../../app');
const { createMockAdminUser, createMockModeratorUser } = require('../setup');

describe('Admin Reports Queue Tests', () => {
  let app;
  let mockAdminUser;
  let mockModeratorUser;

  beforeAll(async () => {
    app = createApp();
    
    // Create mock users with different roles
    mockAdminUser = createMockAdminUser();
    mockModeratorUser = createMockModeratorUser();
  });

  describe('GET /api/v1/admin/reports', () => {
    it('should allow admin to get unified reports', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toBeDefined();
    });

    it('should allow moderator to get unified reports', async () => {
      const moderatorToken = mockModeratorUser.token;

      const response = await request(app)
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toBeDefined();
    });

    it('should filter reports by status', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/reports?status=new')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should filter reports by surface', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/reports?surface=feed')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should filter reports by entity type', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/reports?entityType=post')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should filter reports by community ID', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/reports?communityId=test-community-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should filter reports by date range', async () => {
      const adminToken = mockAdminUser.token;
      const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const toDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/v1/admin/reports?from=${fromDate}&to=${toDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should support pagination with cursor', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/reports?cursor=test-cursor&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.meta).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/reports?limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should return 403 for regular users', async () => {
      const regularUserToken = 'invalid-token';

      await request(app)
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app)
        .get('/api/v1/admin/reports')
        .expect(401);
    });
  });

  describe('POST /api/v1/admin/reports/:id/claim', () => {
    it('should allow admin to claim a report', async () => {
      const adminToken = mockAdminUser.token;
      const reportId = 'test-report-id';

      const response = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/claim`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ surface: 'feed' })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow moderator to claim a report', async () => {
      const moderatorToken = mockModeratorUser.token;
      const reportId = 'test-report-id';

      const response = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/claim`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ surface: 'chat' })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should require surface parameter', async () => {
      const adminToken = mockAdminUser.token;
      const reportId = 'test-report-id';

      const response = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/claim`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate surface enum values', async () => {
      const adminToken = mockAdminUser.token;
      const reportId = 'test-report-id';

      const response = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/claim`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ surface: 'invalid-surface' })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 403 for regular users', async () => {
      const regularUserToken = 'invalid-token';
      const reportId = 'test-report-id';

      await request(app)
        .post(`/api/v1/admin/reports/${reportId}/claim`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ surface: 'feed' })
        .expect(403);
    });
  });

  describe('POST /api/v1/admin/reports/:id/resolve', () => {
    it('should allow admin to resolve a report', async () => {
      const adminToken = mockAdminUser.token;
      const reportId = 'test-report-id';

      const response = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          surface: 'feed',
          resolutionCode: 'removed_content',
          note: 'Content violated community guidelines'
        })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow moderator to resolve a report', async () => {
      const moderatorToken = mockModeratorUser.token;
      const reportId = 'test-report-id';

      const response = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/resolve`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ 
          surface: 'chat',
          resolutionCode: 'warned_user',
          note: 'User warned about inappropriate behavior'
        })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should require surface and resolutionCode parameters', async () => {
      const adminToken = mockAdminUser.token;
      const reportId = 'test-report-id';

      const response = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'Just a note' })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate note length', async () => {
      const adminToken = mockAdminUser.token;
      const reportId = 'test-report-id';
      const longNote = 'a'.repeat(1001); // Exceeds 1000 character limit

      const response = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          surface: 'feed',
          resolutionCode: 'removed_content',
          note: longNote
        })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 403 for regular users', async () => {
      const regularUserToken = 'invalid-token';
      const reportId = 'test-report-id';

      await request(app)
        .post(`/api/v1/admin/reports/${reportId}/resolve`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ 
          surface: 'feed',
          resolutionCode: 'removed_content'
        })
        .expect(403);
    });
  });

  describe('POST /api/v1/admin/reports/:id/dismiss', () => {
    it('should allow admin to dismiss a report', async () => {
      const adminToken = mockAdminUser.token;
      const reportId = 'test-report-id';

      const response = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/dismiss`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          surface: 'feed',
          note: 'Report dismissed - no violation found'
        })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow moderator to dismiss a report', async () => {
      const moderatorToken = mockModeratorUser.token;
      const reportId = 'test-report-id';

      const response = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/dismiss`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ 
          surface: 'men',
          note: 'Content is within guidelines'
        })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should require surface parameter', async () => {
      const adminToken = mockAdminUser.token;
      const reportId = 'test-report-id';

      const response = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/dismiss`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'Just a note' })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate note length', async () => {
      const adminToken = mockAdminUser.token;
      const reportId = 'test-report-id';
      const longNote = 'a'.repeat(1001); // Exceeds 1000 character limit

      const response = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/dismiss`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          surface: 'feed',
          note: longNote
        })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 403 for regular users', async () => {
      const regularUserToken = 'invalid-token';
      const reportId = 'test-report-id';

      await request(app)
        .post(`/api/v1/admin/reports/${reportId}/dismiss`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ 
          surface: 'feed',
          note: 'Report dismissed'
        })
        .expect(403);
    });
  });

  describe('POST /api/v1/admin/reports/bulk/resolve', () => {
    it('should allow admin to bulk resolve reports', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .post('/api/v1/admin/reports/bulk/resolve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          reportIds: ['report-1', 'report-2', 'report-3'],
          surface: 'feed',
          resolutionCode: 'removed_content',
          note: 'Bulk removal of violating content'
        })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow moderator to bulk resolve reports', async () => {
      const moderatorToken = mockModeratorUser.token;

      const response = await request(app)
        .post('/api/v1/admin/reports/bulk/resolve')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ 
          reportIds: ['report-1', 'report-2'],
          surface: 'chat',
          resolutionCode: 'warned_user'
        })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should require reportIds, surface, and resolutionCode', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .post('/api/v1/admin/reports/bulk/resolve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          reportIds: ['report-1'],
          surface: 'feed'
          // Missing resolutionCode
        })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate reportIds array size', async () => {
      const adminToken = mockAdminUser.token;
      const largeReportIds = Array.from({ length: 101 }, (_, i) => `report-${i}`);

      const response = await request(app)
        .post('/api/v1/admin/reports/bulk/resolve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          reportIds: largeReportIds,
          surface: 'feed',
          resolutionCode: 'removed_content'
        })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate reportIds array is not empty', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .post('/api/v1/admin/reports/bulk/resolve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          reportIds: [],
          surface: 'feed',
          resolutionCode: 'removed_content'
        })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 403 for regular users', async () => {
      const regularUserToken = 'invalid-token';

      await request(app)
        .post('/api/v1/admin/reports/bulk/resolve')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ 
          reportIds: ['report-1'],
          surface: 'feed',
          resolutionCode: 'removed_content'
        })
        .expect(403);
    });
  });

  describe('POST /api/v1/admin/reports/bulk/dismiss', () => {
    it('should allow admin to bulk dismiss reports', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .post('/api/v1/admin/reports/bulk/dismiss')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          reportIds: ['report-1', 'report-2', 'report-3'],
          surface: 'feed',
          note: 'Bulk dismissal - no violations found'
        })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow moderator to bulk dismiss reports', async () => {
      const moderatorToken = mockModeratorUser.token;

      const response = await request(app)
        .post('/api/v1/admin/reports/bulk/dismiss')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ 
          reportIds: ['report-1', 'report-2'],
          surface: 'men'
        })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should require reportIds and surface', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .post('/api/v1/admin/reports/bulk/dismiss')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          reportIds: ['report-1']
          // Missing surface
        })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate reportIds array size', async () => {
      const adminToken = mockAdminUser.token;
      const largeReportIds = Array.from({ length: 101 }, (_, i) => `report-${i}`);

      const response = await request(app)
        .post('/api/v1/admin/reports/bulk/dismiss')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          reportIds: largeReportIds,
          surface: 'feed'
        })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 403 for regular users', async () => {
      const regularUserToken = 'invalid-token';

      await request(app)
        .post('/api/v1/admin/reports/bulk/dismiss')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ 
          reportIds: ['report-1'],
          surface: 'feed'
        })
        .expect(403);
    });
  });

  describe('Report Status Transitions', () => {
    it('should handle report workflow: new -> in_review -> resolved', async () => {
      const adminToken = mockAdminUser.token;
      const reportId = 'test-report-id';

      // 1. Claim the report (new -> in_review)
      const claimResponse = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/claim`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ surface: 'feed' })
        .expect(200);

      expect(claimResponse.body.ok).toBe(true);

      // 2. Resolve the report (in_review -> resolved)
      const resolveResponse = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          surface: 'feed',
          resolutionCode: 'removed_content'
        })
        .expect(200);

      expect(resolveResponse.body.ok).toBe(true);
    });

    it('should handle report workflow: new -> in_review -> dismissed', async () => {
      const moderatorToken = mockModeratorUser.token;
      const reportId = 'test-report-id-2';

      // 1. Claim the report (new -> in_review)
      const claimResponse = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/claim`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ surface: 'chat' })
        .expect(200);

      expect(claimResponse.body.ok).toBe(true);

      // 2. Dismiss the report (in_review -> dismissed)
      const dismissResponse = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/dismiss`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ 
          surface: 'chat',
          note: 'No violation found'
        })
        .expect(200);

      expect(dismissResponse.body.ok).toBe(true);
    });
  });
});
