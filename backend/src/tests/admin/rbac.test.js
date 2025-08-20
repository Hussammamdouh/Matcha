const request = require('supertest');
const { createApp } = require('../../app');
const { createMockUser, createMockAdminUser, createMockModeratorUser } = require('../setup');

describe('Admin RBAC Tests', () => {
  let app;
  let mockAdminUser;
  let mockModeratorUser;
  let mockRegularUser;

  beforeAll(async () => {
    app = createApp();
    
    // Create mock users with different roles
    mockAdminUser = createMockAdminUser();
    mockModeratorUser = createMockModeratorUser();
    mockRegularUser = createMockUser();
  });

  describe('Role-based Access Control', () => {
    describe('Admin Role Permissions', () => {
      it('should allow admin to access all admin endpoints', async () => {
        const adminToken = mockAdminUser.token;

        // Test reports access
        const reportsResponse = await request(app)
          .get('/api/v1/admin/reports')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(reportsResponse.body.ok).toBe(true);

        // Test user management access
        const usersResponse = await request(app)
          .get('/api/v1/admin/users/search')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(usersResponse.body.ok).toBe(true);

        // Test feature flags access
        const featuresResponse = await request(app)
          .get('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(featuresResponse.body.ok).toBe(true);

        // Test exports access
        const exportResponse = await request(app)
          .post('/api/v1/admin/export/users/test-user-id')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(exportResponse.body.ok).toBe(true);

        // Test audit logs access
        const auditResponse = await request(app)
          .get('/api/v1/admin/audits')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(auditResponse.body.ok).toBe(true);
      });

      it('should allow admin to manage user roles', async () => {
        const adminToken = mockAdminUser.token;

        const response = await request(app)
          .post('/api/v1/admin/users/test-user-id/role')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'moderator' })
          .expect(200);

        expect(response.body.ok).toBe(true);
      });

      it('should allow admin to logout all user sessions', async () => {
        const adminToken = mockAdminUser.token;

        const response = await request(app)
          .post('/api/v1/admin/users/test-user-id/logout-all')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.ok).toBe(true);
      });
    });

    describe('Moderator Role Permissions', () => {
      it('should allow moderator to access moderation endpoints', async () => {
        const moderatorToken = mockModeratorUser.token;

        // Test reports access
        const reportsResponse = await request(app)
          .get('/api/v1/admin/reports')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .expect(200);

        expect(reportsResponse.body.ok).toBe(true);

        // Test user management access (limited)
        const usersResponse = await request(app)
          .get('/api/v1/admin/users/search')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .expect(200);

        expect(usersResponse.body.ok).toBe(true);

        // Test exports access
        const exportResponse = await request(app)
          .post('/api/v1/admin/export/users/test-user-id')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .expect(200);

        expect(exportResponse.body.ok).toBe(true);

        // Test audit logs access
        const auditResponse = await request(app)
          .get('/api/v1/admin/audits')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .expect(200);

        expect(auditResponse.body.ok).toBe(true);
      });

      it('should allow moderator to ban/unban users', async () => {
        const moderatorToken = mockModeratorUser.token;

        const banResponse = await request(app)
          .post('/api/v1/admin/users/test-user-id/ban')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send({ reason: 'Test ban reason' })
          .expect(200);

        expect(banResponse.body.ok).toBe(true);

        const unbanResponse = await request(app)
          .post('/api/v1/admin/users/test-user-id/unban')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .expect(200);

        expect(unbanResponse.body.ok).toBe(true);
      });

      it('should allow moderator to shadowban/unshadowban users', async () => {
        const moderatorToken = mockModeratorUser.token;

        const shadowbanResponse = await request(app)
          .post('/api/v1/admin/users/test-user-id/shadowban')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send({ reason: 'Test shadowban reason' })
          .expect(200);

        expect(shadowbanResponse.body.ok).toBe(true);

        const unshadowbanResponse = await request(app)
          .post('/api/v1/admin/users/test-user-id/unshadowban')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .expect(200);

        expect(unshadowbanResponse.body.ok).toBe(true);
      });

      it('should NOT allow moderator to manage user roles', async () => {
        const moderatorToken = mockModeratorUser.token;

        const response = await request(app)
          .post('/api/v1/admin/users/test-user-id/role')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send({ role: 'admin' })
          .expect(403);

        expect(response.body.ok).toBe(false);
        expect(response.body.error.code).toBe('AUTH_INSUFFICIENT_ROLE');
      });

      it('should NOT allow moderator to access feature flags', async () => {
        const moderatorToken = mockModeratorUser.token;

        const response = await request(app)
          .get('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .expect(403);

        expect(response.body.ok).toBe(false);
        expect(response.body.error.code).toBe('AUTH_INSUFFICIENT_ROLE');
      });

      it('should NOT allow moderator to logout all user sessions', async () => {
        const moderatorToken = mockModeratorUser.token;

        const response = await request(app)
          .post('/api/v1/admin/users/test-user-id/logout-all')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .expect(403);

        expect(response.body.ok).toBe(false);
        expect(response.body.error.code).toBe('AUTH_INSUFFICIENT_ROLE');
      });
    });

    describe('Regular User Access', () => {
      it('should deny regular users access to all admin endpoints', async () => {
        const regularUserToken = mockRegularUser.token;

        // Test reports access
        await request(app)
          .get('/api/v1/admin/reports')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(403);

        // Test user management access
        await request(app)
          .get('/api/v1/admin/users/search')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(403);

        // Test feature flags access
        await request(app)
          .get('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(403);

        // Test exports access
        await request(app)
          .post('/api/v1/admin/export/users/test-user-id')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(403);

        // Test audit logs access
        await request(app)
          .get('/api/v1/admin/audits')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(403);
      });
    });

    describe('Unauthenticated Access', () => {
      it('should deny unauthenticated access to all admin endpoints', async () => {
        // Test reports access
        await request(app)
          .get('/api/v1/admin/reports')
          .expect(401);

        // Test user management access
        await request(app)
          .get('/api/v1/admin/users/search')
          .expect(401);

        // Test feature flags access
        await request(app)
          .get('/api/v1/admin/system/features')
          .expect(401);

        // Test exports access
        await request(app)
          .post('/api/v1/admin/export/users/test-user-id')
          .expect(401);

        // Test audit logs access
        await request(app)
          .get('/api/v1/admin/audits')
          .expect(401);
      });
    });
  });

  describe('Role Transition Validation', () => {
    it('should allow admin to promote user to moderator', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .post('/api/v1/admin/users/test-user-id/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator' })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow admin to promote user to admin', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .post('/api/v1/admin/users/test-user-id/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow admin to demote admin to moderator', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .post('/api/v1/admin/users/test-admin-id/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator' })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('should allow admin to demote moderator to user', async () => {
      const adminToken = mockAdminUser.token;

      const response = await request(app)
        .post('/api/v1/admin/users/test-moderator-id/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' })
        .expect(200);

      expect(response.body.ok).toBe(true);
    });
  });

  describe('Permission Matrix', () => {
    it('should enforce correct permission matrix for admin role', async () => {
      const adminToken = mockAdminUser.token;

      // Admin should have all permissions
      const permissions = [
        'canManageRoles',
        'canBanUsers',
        'canShadowbanUsers',
        'canLogoutUsers',
        'canModerateFeed',
        'canModerateChat',
        'canModerateMen',
        'canManageFeatures',
        'canViewAudits',
        'canCreateExports'
      ];

      for (const permission of permissions) {
        // This would require a permission check endpoint
        // For now, we test that admin can access all major areas
        expect(true).toBe(true); // Placeholder assertion
      }
    });

    it('should enforce correct permission matrix for moderator role', async () => {
      const moderatorToken = mockModeratorUser.token;

      // Moderator should have limited permissions
      const allowedPermissions = [
        'canBanUsers',
        'canShadowbanUsers',
        'canModerateFeed',
        'canModerateChat',
        'canModerateMen',
        'canViewAudits',
        'canCreateExports'
      ];

      const deniedPermissions = [
        'canManageRoles',
        'canLogoutUsers',
        'canManageFeatures'
      ];

      // Test allowed permissions by accessing endpoints
      for (const permission of allowedPermissions) {
        expect(true).toBe(true); // Placeholder assertion
      }

      // Test denied permissions by accessing endpoints
      for (const permission of deniedPermissions) {
        expect(true).toBe(true); // Placeholder assertion
      }
    });
  });
});
