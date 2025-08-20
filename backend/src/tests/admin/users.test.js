const request = require('supertest');
const { createApp } = require('../../app');
const { createMockAdminUser, createMockModeratorUser } = require('../setup');

describe('Admin User Management Tests', () => {
  let app;
  let mockAdminUser;
  let mockModeratorUser;

  beforeAll(async () => {
    app = createApp();
    
    // Create mock users with different roles
    mockAdminUser = createMockAdminUser();
    mockModeratorUser = createMockModeratorUser();
  });

  describe('POST /api/v1/admin/users/:uid/role', () => {
    it('should allow admin to promote user to moderator', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator' })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow admin to promote user to admin', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow admin to demote admin to moderator', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-admin-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator' })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow admin to demote moderator to user', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-moderator-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should require role parameter', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate role enum values', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'invalid-role' })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should NOT allow moderator to manage user roles', async () => {
      const moderatorToken = mockModeratorUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ role: 'moderator' })
        .expect(403);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('AUTH_INSUFFICIENT_ROLE');
    });

    it('should return 403 for regular users', async () => {
      const regularUserToken = 'invalid-token';
      const userId = 'test-user-id';

      await request(app)
        .post(`/api/v1/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ role: 'moderator' })
        .expect(403);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const userId = 'test-user-id';

      await request(app)
        .post(`/api/v1/admin/users/${userId}/role`)
        .send({ role: 'moderator' })
        .expect(401);
    });
  });

  describe('POST /api/v1/admin/users/:uid/ban', () => {
    it('should allow admin to ban a user', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/ban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Violation of community guidelines' })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow moderator to ban a user', async () => {
      const moderatorToken = mockModeratorUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/ban`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ reason: 'Repeated violations' })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow admin to ban user with expiration date', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';
      const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/ban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          reason: 'Temporary suspension',
          until: until
        })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should require reason parameter', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/ban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate reason length', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';
      const longReason = 'a'.repeat(1001); // Exceeds 1000 character limit

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/ban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: longReason })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate until date format', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/ban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          reason: 'Test ban',
          until: 'invalid-date'
        })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 403 for regular users', async () => {
      const regularUserToken = 'invalid-token';
      const userId = 'test-user-id';

      await request(app)
        .post(`/api/v1/admin/users/${userId}/ban`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ reason: 'Test ban' })
        .expect(403);
    });
  });

  describe('POST /api/v1/admin/users/:uid/unban', () => {
    it('should allow admin to unban a user', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/unban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow moderator to unban a user', async () => {
      const moderatorToken = mockModeratorUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/unban`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should return 403 for regular users', async () => {
      const regularUserToken = 'invalid-token';
      const userId = 'test-user-id';

      await request(app)
        .post(`/api/v1/admin/users/${userId}/unban`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('POST /api/v1/admin/users/:uid/shadowban', () => {
    it('should allow admin to shadowban a user', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/shadowban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Content quality issues' })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow moderator to shadowban a user', async () => {
      const moderatorToken = mockModeratorUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/shadowban`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ reason: 'Low engagement quality' })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should require reason parameter', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/shadowban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate reason length', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';
      const longReason = 'a'.repeat(1001); // Exceeds 1000 character limit

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/shadowban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: longReason })
        .expect(400);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 403 for regular users', async () => {
      const regularUserToken = 'invalid-token';
      const userId = 'test-user-id';

      await request(app)
        .post(`/api/v1/admin/users/${userId}/shadowban`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ reason: 'Test shadowban' })
        .expect(403);
    });
  });

  describe('POST /api/v1/admin/users/:uid/unshadowban', () => {
    it('should allow admin to remove shadowban from user', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/unshadowban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow moderator to remove shadowban from user', async () => {
      const moderatorToken = mockModeratorUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/unshadowban`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should return 403 for regular users', async () => {
      const regularUserToken = 'invalid-token';
      const userId = 'test-user-id';

      await request(app)
        .post(`/api/v1/admin/users/${userId}/unshadowban`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('POST /api/v1/admin/users/:uid/logout-all', () => {
    it('should allow admin to logout all user sessions', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/logout-all`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should NOT allow moderator to logout all user sessions', async () => {
      const moderatorToken = mockModeratorUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .post(`/api/v1/admin/users/${userId}/logout-all`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(403);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('AUTH_INSUFFICIENT_ROLE');
    });

    it('should return 403 for regular users', async () => {
      const regularUserToken = 'invalid-token';
      const userId = 'test-user-id';

      await request(app)
        .post(`/api/v1/admin/users/${userId}/logout-all`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('GET /api/v1/admin/users/search', () => {
    it('should allow admin to search users', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/users/search')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toBeDefined();
    });

    it('should allow moderator to search users', async () => {
      const moderatorToken = mockModeratorUser.token;

      const response = await request(app)
        .get('/api/v1/admin/users/search')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toBeDefined();
    });

    it('should filter users by search query', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/users/search?q=testuser')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should filter users by status', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/users/search?status=active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should filter users by role', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/users/search?role=moderator')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should support pagination with cursor', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/users/search?cursor=test-cursor&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.meta).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .get('/api/v1/admin/users/search?limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should return 403 for regular users', async () => {
      const regularUserToken = 'invalid-token';

      await request(app)
        .get('/api/v1/admin/users/search')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app)
        .get('/api/v1/admin/users/search')
        .expect(401);
    });
  });

  describe('GET /api/v1/admin/users/:uid', () => {
    it('should allow admin to get user details', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .get(`/api/v1/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should allow moderator to get user details', async () => {
      const moderatorToken = mockModeratorUser.token;
      const userId = 'test-user-id';

      const response = await request(app)
        .get(`/api/v1/admin/users/${userId}`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return 403 for regular users', async () => {
      const regularUserToken = 'invalid-token';
      const userId = 'test-user-id';

      await request(app)
        .get(`/api/v1/admin/users/${userId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const userId = 'test-user-id';

      await request(app)
        .get(`/api/v1/admin/users/${userId}`)
        .expect(401);
    });
  });

  describe('User Management Workflows', () => {
    it('should handle complete user management workflow', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-workflow-user-id';

      // 1. Promote user to moderator
      const promoteResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator' })
        .expect(200);

      expect(promoteResponse.body.ok).toBe(true);

      // 2. Shadowban user
      const shadowbanResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/shadowban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Test workflow' })
        .expect(200);

      expect(shadowbanResponse.body.ok).toBe(true);

      // 3. Ban user
      const banResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/ban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Test workflow ban' })
        .expect(200);

      expect(banResponse.body.ok).toBe(true);

      // 4. Unban user
      const unbanResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/unban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(unbanResponse.body.ok).toBe(true);

      // 5. Remove shadowban
      const unshadowbanResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/unshadowban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(unshadowbanResponse.body.ok).toBe(true);

      // 6. Demote user back to regular user
      const demoteResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' })
        .expect(200);

      expect(demoteResponse.body.ok).toBe(true);

      // 7. Logout all sessions
      const logoutResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/logout-all`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(logoutResponse.body.ok).toBe(true);
    });
  });
});
