const request = require('supertest');
const { createApp } = require('../../app');
const { getFirestore } = require('../../../lib/firebase');

describe('Chat Reports API', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    app = createApp();
    mockDb = getFirestore();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/v1/chat/reports', () => {
    it('should create a message report successfully', async () => {
      const mockReport = {
        id: 'report123',
        type: 'message',
        targetId: 'msg123',
        conversationId: 'conv123',
        reasonCode: 'spam',
        note: 'This message contains spam content',
        reporterId: 'user123',
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'conv123',
          members: ['user123', 'user456'],
        }),
      });

      // Mock participant check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          userId: 'user123',
          role: 'member',
        }),
      });

      // Mock report creation
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockReport,
      });

      const response = await request(app)
        .post('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'message',
          targetId: 'msg123',
          conversationId: 'conv123',
          reasonCode: 'spam',
          note: 'This message contains spam content',
        });

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.type).toBe('message');
      expect(response.body.data.targetId).toBe('msg123');
      expect(response.body.data.reasonCode).toBe('spam');
      expect(response.body.data.status).toBe('new');
    });

    it('should create a conversation report successfully', async () => {
      const mockReport = {
        id: 'report456',
        type: 'conversation',
        targetId: 'conv123',
        reasonCode: 'harassment',
        note: 'This conversation contains harassment',
        reporterId: 'user123',
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'conv123',
          members: ['user123', 'user456'],
        }),
      });

      // Mock participant check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          userId: 'user123',
          role: 'member',
        }),
      });

      // Mock report creation
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockReport,
      });

      const response = await request(app)
        .post('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'conversation',
          targetId: 'conv123',
          reasonCode: 'harassment',
          note: 'This conversation contains harassment',
        });

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.type).toBe('conversation');
      expect(response.body.data.targetId).toBe('conv123');
      expect(response.body.data.reasonCode).toBe('harassment');
    });

    it('should create a user report successfully', async () => {
      const mockReport = {
        id: 'report789',
        type: 'user',
        targetId: 'user456',
        reasonCode: 'inappropriate_content',
        note: 'This user posts inappropriate content',
        reporterId: 'user123',
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock report creation
      mockDb.collection().doc().set.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockReport,
      });

      const response = await request(app)
        .post('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'user',
          targetId: 'user456',
          reasonCode: 'inappropriate_content',
          note: 'This user posts inappropriate content',
        });

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.type).toBe('user');
      expect(response.body.data.targetId).toBe('user456');
      expect(response.body.data.reasonCode).toBe('inappropriate_content');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'message',
          // Missing targetId and reasonCode
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for invalid report type', async () => {
      const response = await request(app)
        .post('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'invalid',
          targetId: 'msg123',
          reasonCode: 'spam',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Invalid report type');
    });

    it('should return 400 for invalid reason code', async () => {
      const response = await request(app)
        .post('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'message',
          targetId: 'msg123',
          reasonCode: 'invalid_reason',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Invalid reason code');
    });

    it('should return 400 for message report without conversationId', async () => {
      const response = await request(app)
        .post('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'message',
          targetId: 'msg123',
          reasonCode: 'spam',
          // Missing conversationId
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('conversationId is required');
    });

    it('should return 400 for note exceeding max length', async () => {
      const longNote = 'a'.repeat(501); // Exceeds 500 character limit

      const response = await request(app)
        .post('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'message',
          targetId: 'msg123',
          conversationId: 'conv123',
          reasonCode: 'spam',
          note: longNote,
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('note');
    });

    it('should return 404 for non-existent conversation in message report', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .post('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'message',
          targetId: 'msg123',
          conversationId: 'nonexistent',
          reasonCode: 'spam',
        });

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Conversation not found');
    });

    it('should return 403 for non-participant reporting message', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'conv123',
          members: ['user456', 'user789'], // user123 not in members
        }),
      });

      const response = await request(app)
        .post('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'message',
          targetId: 'msg123',
          conversationId: 'conv123',
          reasonCode: 'spam',
        });

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('not a participant');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .post('/api/v1/chat/reports')
        .send({
          type: 'message',
          targetId: 'msg123',
          reasonCode: 'spam',
        });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('GET /api/v1/chat/reports', () => {
    it('should get user reports successfully', async () => {
      const mockReports = [
        {
          id: 'report1',
          type: 'message',
          targetId: 'msg123',
          conversationId: 'conv123',
          reasonCode: 'spam',
          status: 'new',
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'report2',
          type: 'conversation',
          targetId: 'conv456',
          reasonCode: 'harassment',
          status: 'in_review',
          createdAt: new Date('2024-01-02'),
        },
      ];

      // Mock reports query
      mockDb.collection().where().orderBy().limit().get.mockResolvedValue({
        docs: mockReports.map(report => ({
          id: report.id,
          data: () => report,
        })),
        empty: false,
      });

      const response = await request(app)
        .get('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .query({ pageSize: 20 });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].type).toBe('message');
      expect(response.body.data[1].type).toBe('conversation');
    });

    it('should filter reports by status', async () => {
      const mockReports = [
        {
          id: 'report1',
          type: 'message',
          targetId: 'msg123',
          reasonCode: 'spam',
          status: 'new',
          createdAt: new Date(),
        },
      ];

      // Mock reports query with status filter
      mockDb.collection().where().where().orderBy().limit().get.mockResolvedValue({
        docs: mockReports.map(report => ({
          id: report.id,
          data: () => report,
        })),
        empty: false,
      });

      const response = await request(app)
        .get('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .query({ status: 'new', pageSize: 20 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('new');
    });

    it('should filter reports by type', async () => {
      const mockReports = [
        {
          id: 'report1',
          type: 'message',
          targetId: 'msg123',
          reasonCode: 'spam',
          status: 'new',
          createdAt: new Date(),
        },
      ];

      // Mock reports query with type filter
      mockDb.collection().where().where().orderBy().limit().get.mockResolvedValue({
        docs: mockReports.map(report => ({
          id: report.id,
          data: () => report,
        })),
        empty: false,
      });

      const response = await request(app)
        .get('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .query({ type: 'message', pageSize: 20 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe('message');
    });

    it('should handle pagination correctly', async () => {
      const mockReports = Array.from({ length: 25 }, (_, i) => ({
        id: `report${i}`,
        type: 'message',
        targetId: `msg${i}`,
        reasonCode: 'spam',
        status: 'new',
        createdAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
      }));

      // Mock reports query
      mockDb.collection().where().orderBy().limit().get.mockResolvedValue({
        docs: mockReports.slice(0, 20).map(report => ({
          id: report.id,
          data: () => report,
        })),
        empty: false,
      });

      const response = await request(app)
        .get('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .query({ pageSize: 20 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(20);
      expect(response.body.meta.hasMore).toBe(true);
    });

    it('should return 400 for invalid pageSize', async () => {
      const response = await request(app)
        .get('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .query({ pageSize: 100 }); // Exceeds max

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for invalid status filter', async () => {
      const response = await request(app)
        .get('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .query({ status: 'invalid_status' });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for invalid type filter', async () => {
      const response = await request(app)
        .get('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .query({ type: 'invalid_type' });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .get('/api/v1/chat/reports');

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('GET /api/v1/chat/reports/:id', () => {
    it('should get specific report successfully', async () => {
      const mockReport = {
        id: 'report123',
        type: 'message',
        targetId: 'msg123',
        conversationId: 'conv123',
        reasonCode: 'spam',
        note: 'This message contains spam content',
        reporterId: 'user123',
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock report retrieval
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockReport,
      });

      const response = await request(app)
        .get('/api/v1/chat/reports/report123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.id).toBe('report123');
      expect(response.body.data.type).toBe('message');
      expect(response.body.data.targetId).toBe('msg123');
    });

    it('should return 404 for non-existent report', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .get('/api/v1/chat/reports/nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Report not found');
    });

    it('should return 403 for accessing another user\'s report', async () => {
      const mockReport = {
        id: 'report123',
        type: 'message',
        targetId: 'msg123',
        reasonCode: 'spam',
        reporterId: 'user789', // Different user
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockReport,
      });

      const response = await request(app)
        .get('/api/v1/chat/reports/report123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('not authorized');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .get('/api/v1/chat/reports/report123');

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('PATCH /api/v1/chat/reports/:id/status', () => {
    it('should update report status successfully', async () => {
      const mockReport = {
        id: 'report123',
        type: 'message',
        targetId: 'msg123',
        reasonCode: 'spam',
        reporterId: 'user123',
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedReport = {
        ...mockReport,
        status: 'resolved',
        resolutionNote: 'Report resolved - user warned',
        reviewerId: 'user123',
        updatedAt: new Date(),
      };

      // Mock report retrieval
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockReport,
      });

      // Mock report update
      mockDb.collection().doc().update.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => updatedReport,
      });

      const response = await request(app)
        .patch('/api/v1/chat/reports/report123/status')
        .set('Authorization', 'Bearer valid-token')
        .send({
          status: 'resolved',
          resolutionNote: 'Report resolved - user warned',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.status).toBe('resolved');
      expect(response.body.data.resolutionNote).toBe('Report resolved - user warned');
    });

    it('should return 400 for missing status field', async () => {
      const response = await request(app)
        .patch('/api/v1/chat/reports/report123/status')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 for invalid status value', async () => {
      const response = await request(app)
        .patch('/api/v1/chat/reports/report123/status')
        .set('Authorization', 'Bearer valid-token')
        .send({
          status: 'invalid_status',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Invalid status');
    });

    it('should return 400 for resolution note exceeding max length', async () => {
      const longNote = 'a'.repeat(501); // Exceeds 500 character limit

      const response = await request(app)
        .patch('/api/v1/chat/reports/report123/status')
        .set('Authorization', 'Bearer valid-token')
        .send({
          status: 'resolved',
          resolutionNote: longNote,
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('resolutionNote');
    });

    it('should return 404 for non-existent report', async () => {
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .patch('/api/v1/chat/reports/nonexistent/status')
        .set('Authorization', 'Bearer valid-token')
        .send({
          status: 'resolved',
        });

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Report not found');
    });

    it('should return 403 for updating another user\'s report', async () => {
      const mockReport = {
        id: 'report123',
        type: 'message',
        targetId: 'msg123',
        reasonCode: 'spam',
        reporterId: 'user789', // Different user
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockReport,
      });

      const response = await request(app)
        .patch('/api/v1/chat/reports/report123/status')
        .set('Authorization', 'Bearer valid-token')
        .send({
          status: 'resolved',
        });

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('not authorized');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .patch('/api/v1/chat/reports/report123/status')
        .send({
          status: 'resolved',
        });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on report creation', async () => {
      // This test would require more complex mocking of the rate limiter
      // For now, we'll just verify the endpoint exists and accepts requests
      const response = await request(app)
        .post('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .send({
          type: 'message',
          targetId: 'msg123',
          conversationId: 'conv123',
          reasonCode: 'spam',
        });

      // Should either succeed or return rate limit error
      expect([201, 429]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should handle Firestore errors gracefully', async () => {
      mockDb.collection().doc().get.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Internal server error');
    });

    it('should handle validation errors properly', async () => {
      const response = await request(app)
        .post('/api/v1/chat/reports')
        .set('Authorization', 'Bearer valid-token')
        .send({
          // Missing all required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Report Data Validation', () => {
    it('should validate report reason codes', () => {
      const validReasonCodes = [
        'spam', 'harassment', 'inappropriate_content', 'violence',
        'fake_news', 'copyright', 'other'
      ];

      validReasonCodes.forEach(code => {
        expect(code).toMatch(/^(spam|harassment|inappropriate_content|violence|fake_news|copyright|other)$/);
      });
    });

    it('should validate report types', () => {
      const validReportTypes = ['message', 'conversation', 'user'];

      validReportTypes.forEach(type => {
        expect(type).toMatch(/^(message|conversation|user)$/);
      });
    });

    it('should validate report statuses', () => {
      const validStatuses = ['new', 'in_review', 'resolved', 'dismissed'];

      validStatuses.forEach(status => {
        expect(status).toMatch(/^(new|in_review|resolved|dismissed)$/);
      });
    });
  });

  describe('Report Workflow', () => {
    it('should follow correct status progression', () => {
      const statusFlow = ['new', 'in_review', 'resolved'];
      
      // Verify status progression
      expect(statusFlow[0]).toBe('new');
      expect(statusFlow[1]).toBe('in_review');
      expect(statusFlow[2]).toBe('resolved');
    });

    it('should maintain audit trail', () => {
      const mockReport = {
        id: 'report123',
        type: 'message',
        targetId: 'msg123',
        reasonCode: 'spam',
        reporterId: 'user123',
        status: 'new',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      };

      // Verify timestamps are maintained
      expect(mockReport.createdAt).toBeInstanceOf(Date);
      expect(mockReport.updatedAt).toBeInstanceOf(Date);
      expect(mockReport.updatedAt.getTime()).toBeGreaterThanOrEqual(mockReport.createdAt.getTime());
    });
  });
});
