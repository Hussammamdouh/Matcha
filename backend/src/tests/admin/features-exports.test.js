const request = require('supertest');
const { createApp } = require('../../app');
const { createMockAdminUser, createMockModeratorUser } = require('../setup');

describe('Admin Features & Exports Tests', () => {
  let app;
  let mockAdminUser;
  let mockModeratorUser;

  beforeAll(async () => {
    app = createApp();
    
    // Create mock users with different roles
    mockAdminUser = createMockAdminUser();
    mockModeratorUser = createMockModeratorUser();
  });

  describe('Feature Flags Management', () => {
    describe('GET /api/v1/admin/system/features', () => {
      it('should allow admin to get feature flags', async () => {
        const adminToken = mockAdminUser.token;

        const response = await request(app)
          .get('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should NOT allow moderator to get feature flags', async () => {
        const moderatorToken = mockModeratorUser.token;

        const response = await request(app)
          .get('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .expect(403);

        expect(response.body.ok).toBe(false);
        expect(response.body.error.code).toBe('AUTH_INSUFFICIENT_ROLE');
      });

      it('should return 403 for regular users', async () => {
        const regularUserToken = 'invalid-token';

        await request(app)
          .get('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(403);
      });

      it('should return 401 for unauthenticated requests', async () => {
        await request(app)
          .get('/api/v1/admin/system/features')
          .expect(401);
      });
    });

    describe('PATCH /api/v1/admin/system/features', () => {
      it('should allow admin to update feature flags', async () => {
        const adminToken = mockAdminUser.token;

        const response = await request(app)
          .patch('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ 
            updates: {
              chatAudio: false,
              chatTyping: true
            }
          })
          .expect(200);

        expect(response.body.ok).toBe(true);
      });

      it('should allow admin to toggle multiple features', async () => {
        const adminToken = mockAdminUser.token;

        const response = await request(app)
          .patch('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ 
            updates: {
              kyc: true,
              phoneAuth: false,
              recaptcha: true,
              voicePosts: false,
              shadowban: true,
              chatRealtimeWs: false,
              chatPresence: true,
              chatModeration: false,
              chatPush: true
            }
          })
          .expect(200);

        expect(response.body.ok).toBe(true);
      });

      it('should require updates parameter', async () => {
        const adminToken = mockAdminUser.token;

        const response = await request(app)
          .patch('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({})
          .expect(400);

        expect(response.body.ok).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should validate updates object structure', async () => {
        const adminToken = mockAdminUser.token;

        const response = await request(app)
          .patch('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ 
            updates: 'invalid-updates'
          })
          .expect(400);

        expect(response.body.ok).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should validate feature names are safe', async () => {
        const adminToken = mockAdminUser.token;

        const response = await request(app)
          .patch('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ 
            updates: {
              secretFeature: true, // This should not be allowed
              dangerousFlag: false
            }
          })
          .expect(400);

        expect(response.body.ok).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toContain('unsafe features');
      });

      it('should NOT allow moderator to update feature flags', async () => {
        const moderatorToken = mockModeratorUser.token;

        const response = await request(app)
          .patch('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send({ 
            updates: {
              chatAudio: false
            }
          })
          .expect(403);

        expect(response.body.ok).toBe(false);
        expect(response.body.error.code).toBe('AUTH_INSUFFICIENT_ROLE');
      });

      it('should return 403 for regular users', async () => {
        const regularUserToken = 'invalid-token';

        await request(app)
          .patch('/api/v1/admin/system/features')
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send({ 
            updates: {
              chatAudio: false
            }
          })
          .expect(403);
      });
    });

    describe('Feature Flag Validation', () => {
      it('should only allow safe features to be toggled', async () => {
        const adminToken = mockAdminUser.token;

        // Test with safe features
        const safeFeatures = [
          'kyc', 'phoneAuth', 'recaptcha', 'voicePosts', 'shadowban',
          'chatAudio', 'chatRealtimeWs', 'chatTyping', 'chatPresence', 'chatModeration', 'chatPush'
        ];

        for (const feature of safeFeatures) {
          const response = await request(app)
            .patch('/api/v1/admin/system/features')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ 
              updates: { [feature]: true }
            })
            .expect(200);

          expect(response.body.ok).toBe(true);
        }
      });

      it('should reject unsafe feature names', async () => {
        const adminToken = mockAdminUser.token;

        const unsafeFeatures = [
          'secretFeature', 'internalFlag', 'adminSecret', 'dangerousSetting',
          'firebaseKey', 'databasePassword', 'apiSecret'
        ];

        for (const feature of unsafeFeatures) {
          const response = await request(app)
            .patch('/api/v1/admin/system/features')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ 
              updates: { [feature]: true }
            })
            .expect(400);

          expect(response.body.ok).toBe(false);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
        }
      });
    });
  });

  describe('Content Exports', () => {
    describe('POST /api/v1/admin/export/users/:uid', () => {
      it('should allow admin to create export job', async () => {
        const adminToken = mockAdminUser.token;
        const userId = 'test-user-id';

        const response = await request(app)
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

        expect(response.body.ok).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.jobId).toBeDefined();
        expect(response.body.data.status).toBe('pending');
      });

      it('should allow moderator to create export job', async () => {
        const moderatorToken = mockModeratorUser.token;
        const userId = 'test-user-id';

        const response = await request(app)
          .post(`/api/v1/admin/export/users/${userId}`)
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send({
            options: {
              includePosts: true,
              includeComments: false,
              includeMessages: true,
              includeMenSubjects: false,
              includeReports: true
            }
          })
          .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.jobId).toBeDefined();
        expect(response.body.data.status).toBe('pending');
      });

      it('should create export job with default options when none provided', async () => {
        const adminToken = mockAdminUser.token;
        const userId = 'test-user-id';

        const response = await request(app)
          .post(`/api/v1/admin/export/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.jobId).toBeDefined();
        expect(response.body.data.status).toBe('pending');
      });

      it('should validate export options', async () => {
        const adminToken = mockAdminUser.token;
        const userId = 'test-user-id';

        const response = await request(app)
          .post(`/api/v1/admin/export/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            options: {
              includePosts: 'invalid-boolean', // Should be boolean
              includeComments: true,
              includeMessages: true,
              includeMenSubjects: true,
              includeReports: true
            }
          })
          .expect(400);

        expect(response.body.ok).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 403 for regular users', async () => {
        const regularUserToken = 'invalid-token';
        const userId = 'test-user-id';

        await request(app)
          .post(`/api/v1/admin/export/users/${userId}`)
          .set('Authorization', `Bearer ${regularUserToken}`)
          .send({
            options: {
              includePosts: true
            }
          })
          .expect(403);
      });

      it('should return 401 for unauthenticated requests', async () => {
        const userId = 'test-user-id';

        await request(app)
          .post(`/api/v1/admin/export/users/${userId}`)
          .expect(401);
      });
    });

    describe('GET /api/v1/admin/export/jobs/:jobId', () => {
      it('should allow admin to get export job status', async () => {
        const adminToken = mockAdminUser.token;
        const jobId = 'test-job-id';

        const response = await request(app)
          .get(`/api/v1/admin/export/jobs/${jobId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.jobId).toBe(jobId);
      });

      it('should allow moderator to get export job status', async () => {
        const moderatorToken = mockModeratorUser.token;
        const jobId = 'test-job-id';

        const response = await request(app)
          .get(`/api/v1/admin/export/jobs/${jobId}`)
          .set('Authorization', `Bearer ${moderatorToken}`)
          .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.jobId).toBe(jobId);
      });

      it('should return job details with status', async () => {
        const adminToken = mockAdminUser.token;
        const jobId = 'test-job-id';

        const response = await request(app)
          .get(`/api/v1/admin/export/jobs/${jobId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.jobId).toBe(jobId);
        expect(response.body.data.status).toBeDefined();
        expect(response.body.data.userId).toBeDefined();
        expect(response.body.data.requestedBy).toBeDefined();
        expect(response.body.data.createdAt).toBeDefined();
      });

      it('should return download URL when job is completed', async () => {
        const adminToken = mockAdminUser.token;
        const jobId = 'completed-job-id';

        const response = await request(app)
          .get(`/api/v1/admin/export/jobs/${jobId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.jobId).toBe(jobId);
        expect(response.body.data.status).toBe('completed');
        expect(response.body.data.result).toBeDefined();
        expect(response.body.data.result.downloadUrl).toBeDefined();
        expect(response.body.data.completedAt).toBeDefined();
      });

      it('should return 403 for regular users', async () => {
        const regularUserToken = 'invalid-token';
        const jobId = 'test-job-id';

        await request(app)
          .get(`/api/v1/admin/export/jobs/${jobId}`)
          .set('Authorization', `Bearer ${regularUserToken}`)
          .expect(403);
      });

      it('should return 401 for unauthenticated requests', async () => {
        const jobId = 'test-job-id';

        await request(app)
          .get(`/api/v1/admin/export/jobs/${jobId}`)
          .expect(401);
      });
    });

    describe('Export Job Workflow', () => {
      it('should handle complete export workflow', async () => {
        const adminToken = mockAdminUser.token;
        const userId = 'test-workflow-user-id';

        // 1. Create export job
        const createResponse = await request(app)
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

        expect(createResponse.body.ok).toBe(true);
        expect(createResponse.body.data.jobId).toBeDefined();
        expect(createResponse.body.data.status).toBe('pending');

        const jobId = createResponse.body.data.jobId;

        // 2. Check job status (should still be pending)
        const statusResponse = await request(app)
          .get(`/api/v1/admin/export/jobs/${jobId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(statusResponse.body.ok).toBe(true);
        expect(statusResponse.body.data.jobId).toBe(jobId);
        expect(statusResponse.body.data.status).toBe('pending');

        // 3. Simulate job completion (this would normally happen asynchronously)
        // For testing purposes, we're checking the structure of the response
        expect(statusResponse.body.data).toHaveProperty('userId');
        expect(statusResponse.body.data).toHaveProperty('requestedBy');
        expect(statusResponse.body.data).toHaveProperty('createdAt');
        expect(statusResponse.body.data).toHaveProperty('options');
      });

      it('should handle export job with minimal options', async () => {
        const adminToken = mockAdminUser.token;
        const userId = 'test-minimal-user-id';

        const response = await request(app)
          .post(`/api/v1/admin/export/users/${userId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            options: {
              includePosts: false,
              includeComments: false,
              includeMessages: false,
              includeMenSubjects: false,
              includeReports: false
            }
          })
          .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.jobId).toBeDefined();
        expect(response.body.data.status).toBe('pending');
        expect(response.body.data.options).toBeDefined();
        expect(response.body.data.options.includePosts).toBe(false);
        expect(response.body.data.options.includeComments).toBe(false);
        expect(response.body.data.options.includeMessages).toBe(false);
        expect(response.body.data.options.includeMenSubjects).toBe(false);
        expect(response.body.data.options.includeReports).toBe(false);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should allow admin to manage features and create exports', async () => {
      const adminToken = mockAdminUser.token;
      const userId = 'test-integration-user-id';

      // 1. Update feature flags
      const featuresResponse = await request(app)
        .patch('/api/v1/admin/system/features')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          updates: {
            chatAudio: false,
            chatTyping: true,
            chatModeration: true
          }
        })
        .expect(200);

      expect(featuresResponse.body.ok).toBe(true);

      // 2. Create export job
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

      // 3. Check export job status
      const jobId = exportResponse.body.data.jobId;
      const statusResponse = await request(app)
        .get(`/api/v1/admin/export/jobs/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(statusResponse.body.ok).toBe(true);
      expect(statusResponse.body.data.jobId).toBe(jobId);
    });

    it('should enforce role-based access for features and exports', async () => {
      const moderatorToken = mockModeratorUser.token;
      const userId = 'test-role-user-id';

      // 1. Moderator should NOT be able to update feature flags
      const featuresResponse = await request(app)
        .patch('/api/v1/admin/system/features')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ 
          updates: {
            chatAudio: false
          }
        })
        .expect(403);

      expect(featuresResponse.body.ok).toBe(false);
      expect(featuresResponse.body.error.code).toBe('AUTH_INSUFFICIENT_ROLE');

      // 2. Moderator SHOULD be able to create export jobs
      const exportResponse = await request(app)
        .post(`/api/v1/admin/export/users/${userId}`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          options: {
            includePosts: true,
            includeComments: true
          }
        })
        .expect(200);

      expect(exportResponse.body.ok).toBe(true);
      expect(exportResponse.body.data.jobId).toBeDefined();

      // 3. Moderator SHOULD be able to check export job status
      const jobId = exportResponse.body.data.jobId;
      const statusResponse = await request(app)
        .get(`/api/v1/admin/export/jobs/${jobId}`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200);

      expect(statusResponse.body.ok).toBe(true);
      expect(statusResponse.body.data.jobId).toBe(jobId);
    });
  });
});
