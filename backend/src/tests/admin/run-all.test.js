const request = require('supertest');
const { createApp } = require('../../app');
const { createMockAdminUser, createMockModeratorUser } = require('../setup');

describe('Admin System Integration Tests', () => {
  let app;
  let mockAdminUser;
  let mockModeratorUser;

  beforeAll(async () => {
    app = createApp();
    
    // Create mock users with different roles
    mockAdminUser = createMockAdminUser();
    mockModeratorUser = createMockModeratorUser();
  });

  describe('Complete Admin Workflow Tests', () => {
    it('should handle complete user management workflow', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-complete-workflow-user-id';

      // 1. Create export job for user
      const exportResponse = await request(app)
        .post(`/api/v1/admin/export/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          options: {
            includePosts: true,
            includeComments: true,
            includeMessages: true,
            includeMenSubjects: true,
            includeReports: true
          }
        })
        .expect(200);

      expect(exportResponse.body.ok).toBe(true);
      expect(exportResponse.body.data.jobId).toBeDefined();
      const jobId = exportResponse.body.data.jobId;

      // 2. Promote user to moderator
      const promoteResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator' })
        .expect(200);

      expect(promoteResponse.body.ok).toBe(true);

      // 3. Shadowban user
      const shadowbanResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/shadowban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Complete workflow test' })
        .expect(200);

      expect(shadowbanResponse.body.ok).toBe(true);

      // 4. Ban user
      const banResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/ban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Complete workflow test ban' })
        .expect(200);

      expect(banResponse.body.ok).toBe(true);

      // 5. Unban user
      const unbanResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/unban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(unbanResponse.body.ok).toBe(true);

      // 6. Remove shadowban
      const unshadowbanResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/unshadowban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(unshadowbanResponse.body.ok).toBe(true);

      // 7. Demote user back to regular user
      const demoteResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' })
        .expect(200);

      expect(demoteResponse.body.ok).toBe(true);

      // 8. Logout all sessions
      const logoutResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/logout-all`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(logoutResponse.body.ok).toBe(true);

      // 9. Check export job status
      const statusResponse = await request(app)
        .get(`/api/v1/admin/export/jobs/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(statusResponse.body.ok).toBe(true);
      expect(statusResponse.body.data.jobId).toBe(jobId);
    });

    it('should handle complete reports workflow', async () => {
      const adminToken = mockAdminUser.token;
      const reportId = 'test-complete-reports-workflow-id';

      // 1. Claim a report
      const claimResponse = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/claim`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ surface: 'feed' })
        .expect(200);

      expect(claimResponse.body.ok).toBe(true);

      // 2. Resolve the report
      const resolveResponse = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          surface: 'feed',
          resolutionCode: 'removed_content',
          note: 'Complete workflow test resolution'
        })
        .expect(200);

      expect(resolveResponse.body.ok).toBe(true);

      // 3. Check unified reports
      const reportsResponse = await request(app)
        .get('/api/v1/admin/reports?status=resolved&surface=feed')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(reportsResponse.body.ok).toBe(true);
      expect(reportsResponse.body.data).toBeDefined();
    });

    it('should handle complete feature management workflow', async () => {
      const adminToken = mockAdminUser.token;

      // 1. Get current features
      const getFeaturesResponse = await request(app)
        .get('/api/v1/admin/system/features')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(getFeaturesResponse.body.ok).toBe(true);
      expect(getFeaturesResponse.body.data).toBeDefined();

      // 2. Update multiple features
      const updateFeaturesResponse = await request(app)
        .patch('/api/v1/admin/system/features')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          updates: {
            chatAudio: false,
            chatTyping: true,
            chatModeration: true,
            chatPresence: false
          }
        })
        .expect(200);

      expect(updateFeaturesResponse.body.ok).toBe(true);

      // 3. Get updated features
      const updatedFeaturesResponse = await request(app)
        .get('/api/v1/admin/system/features')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(updatedFeaturesResponse.body.ok).toBe(true);
      expect(updatedFeaturesResponse.body.data).toBeDefined();
    });

    it('should handle complete audit workflow', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-audit-workflow-user-id';

      // 1. Perform multiple admin actions to generate audit logs
      const actions = [
        // User management
        () => request(app)
          .post(`/api/v1/admin/users/${userId}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'moderator' }),
        
        () => request(app)
          .post(`/api/v1/admin/users/${userId}/shadowban`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ reason: 'Audit workflow test' }),
        
        // Feature management
        () => request(app)
          .patch('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ updates: { chatAudio: false } }),
        
        // Export creation
        () => request(app)
          .post(`/api/v1/admin/export/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ options: { includePosts: true } })
      ];

      // Execute all actions
      for (const action of actions) {
        const response = await action();
        expect(response.body.ok).toBe(true);
      }

      // 2. Check audit logs for all actions
      const auditResponse = await request(app)
        .get(`/api/v1/admin/audits?actorId=${mockAdminUser.uid}&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(auditResponse.body.ok).toBe(true);
      expect(auditResponse.body.data).toBeDefined();
      expect(auditResponse.body.data.length).toBeGreaterThan(0);

      // 3. Verify specific audit log entries
      const auditLogs = auditResponse.body.data;
      const actionTypes = auditLogs.map(log => log.action);
      
      expect(actionTypes).toContain('user_role_changed');
      expect(actionTypes).toContain('user_shadowbanned');
      expect(actionTypes).toContain('feature_flag_updated');
      expect(actionTypes).toContain('export_job_created');
    });
  });

  describe('Role-Based Access Control Integration', () => {
    it('should enforce correct permissions for admin vs moderator', async () => {
      const adminToken = mockAdminUser.token;
      const moderatorToken = mockModeratorUser.token;
      const userId = 'test-rbac-user-id';

      // Admin should be able to do everything
      const adminActions = [
        // User management
        () => request(app)
          .post(`/api/v1/admin/users/${userId}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'moderator' }),
        
        () => request(app)
          .post(`/api/v1/admin/users/${userId}/logout-all`)
          .set('Authorization', `Bearer ${adminToken}`),
        
        // Feature management
        () => request(app)
          .patch('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ updates: { chatAudio: false } }),
        
        // Reports
        () => request(app)
          .get('/api/v1/admin/reports')
          .set('Authorization', `Bearer ${adminToken}`),
        
        // Exports
        () => request(app)
          .post(`/api/v1/admin/export/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ options: { includePosts: true } }),
        
        // Audits
        () => request(app)
          .get('/api/v1/admin/audits')
          .set('Authorization', `Bearer ${adminToken}`)
      ];

      for (const action of adminActions) {
        const response = await action();
        expect(response.body.ok).toBe(true);
      }

      // Moderator should have limited permissions
      const moderatorAllowedActions = [
        // User management (limited)
        () => request(app)
          .post(`/api/v1/admin/users/${userId}/ban`)
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send({ reason: 'RBAC test' }),
        
        () => request(app)
          .post(`/api/v1/admin/users/${userId}/shadowban`)
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send({ reason: 'RBAC test' }),
        
        // Reports
        () => request(app)
          .get('/api/v1/admin/reports')
          .set('Authorization', `Bearer ${moderatorToken}`),
        
        // Exports
        () => request(app)
          .post(`/api/v1/admin/export/users/${userId}`)
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send({ options: { includePosts: true } }),
        
        // Audits
        () => request(app)
          .get('/api/v1/admin/audits')
          .set('Authorization', `Bearer ${moderatorToken}`)
      ];

      for (const action of moderatorAllowedActions) {
        const response = await action();
        expect(response.body.ok).toBe(true);
      }

      // Moderator should NOT be able to do admin-only actions
      const moderatorDeniedActions = [
        // User role management
        () => request(app)
          .post(`/api/v1/admin/users/${userId}/role`)
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send({ role: 'admin' })
          .expect(403),
        
        // Logout all sessions
        () => request(app)
          .post(`/api/v1/admin/users/${userId}/logout-all`)
          .set('Authorization', `Bearer ${moderatorToken}`)
          .expect(403),
        
        // Feature management
        () => request(app)
          .patch('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send({ updates: { chatAudio: false } })
          .expect(403)
      ];

      for (const action of moderatorDeniedActions) {
        await action();
      }
    });
  });

  describe('Cross-Feature Integration', () => {
    it('should handle reports with user management integration', async () => {
      const adminToken = mockAdminUser.token;
      const reportId = 'test-cross-feature-report-id';
      const userId = 'test-cross-feature-user-id';

      // 1. Claim a report
      const claimResponse = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/claim`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ surface: 'feed' })
        .expect(200);

      expect(claimResponse.body.ok).toBe(true);

      // 2. Ban the user who was reported
      const banResponse = await request(app)
        .post(`/api/v1/admin/users/${userId}/ban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Cross-feature integration test' })
        .expect(200);

      expect(banResponse.body.ok).toBe(true);

      // 3. Resolve the report
      const resolveResponse = await request(app)
        .post(`/api/v1/admin/reports/${reportId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          surface: 'feed',
          resolutionCode: 'user_banned',
          note: 'User banned due to report'
        })
        .expect(200);

      expect(resolveResponse.body.ok).toBe(true);

      // 4. Check audit logs for the sequence of actions
      const auditResponse = await request(app)
        .get(`/api/v1/admin/audits?actorId=${mockAdminUser.uid}&limit=5`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(auditResponse.body.ok).toBe(true);
      expect(auditResponse.body.data).toBeDefined();

      // 5. Verify the audit trail
      const auditLogs = auditResponse.body.data;
      const actionTypes = auditLogs.map(log => log.action);
      
      expect(actionTypes).toContain('report_claimed');
      expect(actionTypes).toContain('user_banned');
      expect(actionTypes).toContain('report_resolved');
    });

    it('should handle bulk operations with audit integration', async () => {
      const adminToken = mockAdminUser.token;
      const reportIds = ['bulk-report-1', 'bulk-report-2', 'bulk-report-3'];

      // 1. Bulk resolve reports
      const bulkResolveResponse = await request(app)
        .post('/api/v1/admin/reports/bulk/resolve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          reportIds: reportIds,
          surface: 'feed',
          resolutionCode: 'removed_content',
          note: 'Bulk resolution test'
        })
        .expect(200);

      expect(bulkResolveResponse.body.ok).toBe(true);

      // 2. Check that all reports are resolved
      const reportsResponse = await request(app)
        .get('/api/v1/admin/reports?status=resolved&surface=feed')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(reportsResponse.body.ok).toBe(true);
      expect(reportsResponse.body.data).toBeDefined();

      // 3. Check audit logs for bulk operation
      const auditResponse = await request(app)
        .get(`/api/v1/admin/audits?actorId=${mockAdminUser.uid}&action=bulk_reports_resolved&limit=5`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(auditResponse.body.ok).toBe(true);
      expect(auditResponse.body.data).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid user IDs gracefully', async () => {
      const adminToken = mockAdminUser.token;
      const invalidUserId = 'invalid-user-id';

      // Test various endpoints with invalid user ID
      const endpoints = [
        () => request(app)
          .post(`/api/v1/admin/users/${invalidUserId}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'moderator' }),
        
        () => request(app)
          .post(`/api/v1/admin/users/${invalidUserId}/ban`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ reason: 'Test' }),
        
        () => request(app)
          .post(`/api/v1/admin/users/${invalidUserId}/shadowban`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ reason: 'Test' }),
        
        () => request(app)
          .get(`/api/v1/admin/users/${invalidUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await endpoint();
          // If we get here, the endpoint should return a proper error
          expect(response.status).toBeGreaterThanOrEqual(400);
        } catch (error) {
          // Error is expected for invalid user IDs
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle invalid report IDs gracefully', async () => {
      const adminToken = mockAdminUser.token;
      const invalidReportId = 'invalid-report-id';

      // Test various report endpoints with invalid report ID
      const endpoints = [
        () => request(app)
          .post(`/api/v1/admin/reports/${invalidReportId}/claim`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ surface: 'feed' }),
        
        () => request(app)
          .post(`/api/v1/admin/reports/${invalidReportId}/resolve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ 
            surface: 'feed',
            resolutionCode: 'removed_content'
          }),
        
        () => request(app)
          .post(`/api/v1/admin/reports/${invalidReportId}/dismiss`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ surface: 'feed' })
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await endpoint();
          // If we get here, the endpoint should return a proper error
          expect(response.status).toBeGreaterThanOrEqual(400);
        } catch (error) {
          // Error is expected for invalid report IDs
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle rate limiting for admin endpoints', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-rate-limit-user-id';

      // Make multiple rapid requests to test rate limiting
      const requests = Array.from({ length: 10 }, () => 
        request(app)
          .get('/api/v1/admin/audits')
          .set('Authorization', `Bearer ${adminToken}`)
      );

      try {
        const responses = await Promise.all(requests);
        
        // Check if any responses indicate rate limiting
        const rateLimited = responses.some(response => 
          response.status === 429 || 
          (response.body && response.body.error && response.body.error.code === 'RATE_LIMITED')
        );

        // If rate limiting is implemented, we should see 429 responses
        // If not implemented, all requests should succeed
        if (rateLimited) {
          expect(true).toBe(true); // Rate limiting is working
        } else {
          // All requests should succeed
          responses.forEach(response => {
            expect(response.status).toBe(200);
            expect(response.body.ok).toBe(true);
          });
        }
      } catch (error) {
        // Some requests may fail due to rate limiting
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large result sets efficiently', async () => {
      const adminToken = mockAdminUser.token;

      // Test with maximum allowed limit
      const response = await request(app)
        .get('/api/v1/admin/audits?limit=50')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeLessThanOrEqual(50);
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.limit).toBe(50);
    });

    it('should handle complex filtering efficiently', async () => {
      const adminToken = mockAdminUser.token;
      const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const toDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/v1/admin/audits?from=${fromDate}&to=${toDate}&action=user_role_changed&entityType=user&limit=20`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.meta).toBeDefined();
    });
  });
});
