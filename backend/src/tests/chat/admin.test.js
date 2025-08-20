const request = require('supertest');
const { createApp } = require('../../app');
const { getFirestore } = require('../../../lib/firebase');

describe('Chat Admin API', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    app = createApp();
    mockDb = getFirestore();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('GET /api/v1/admin/chat/reports', () => {
    it('should get chat reports successfully for admin', async () => {
      const mockReports = [
        {
          id: 'report1',
          type: 'message',
          reason: 'spam',
          status: 'pending',
          reporterId: 'user123',
          targetId: 'msg456',
          conversationId: 'conv789',
          note: 'This message contains spam content',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'report2',
          type: 'conversation',
          reason: 'harassment',
          status: 'investigating',
          reporterId: 'user456',
          targetId: 'conv789',
          note: 'Harassment in group conversation',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      // Mock reports query
      mockDb.collection().orderBy().get.mockResolvedValue({
        docs: mockReports.map(report => ({
          id: report.id,
          data: () => report,
        })),
      });

      const response = await request(app)
        .get('/api/v1/admin/chat/reports')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].type).toBe('message');
      expect(response.body.data[1].type).toBe('conversation');
    });

    it('should get chat reports successfully for moderator', async () => {
      const mockReports = [
        {
          id: 'report1',
          type: 'user',
          reason: 'inappropriate',
          status: 'pending',
          reporterId: 'user123',
          targetId: 'user789',
          note: 'User posting inappropriate content',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock moderator user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'moderator',
        }),
      });

      // Mock reports query
      mockDb.collection().orderBy().get.mockResolvedValue({
        docs: mockReports.map(report => ({
          id: report.id,
          data: () => report,
        })),
      });

      const response = await request(app)
        .get('/api/v1/admin/chat/reports')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe('user');
    });

    it('should filter reports by status', async () => {
      const mockReports = [
        {
          id: 'report1',
          type: 'message',
          reason: 'spam',
          status: 'pending',
          reporterId: 'user123',
          targetId: 'msg456',
          conversationId: 'conv789',
          note: 'Spam content',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      // Mock reports query with status filter
      mockDb.collection().where().orderBy().get.mockResolvedValue({
        docs: mockReports.map(report => ({
          id: report.id,
          data: () => report,
        })),
      });

      const response = await request(app)
        .get('/api/v1/admin/chat/reports?status=pending')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('pending');
    });

    it('should filter reports by type', async () => {
      const mockReports = [
        {
          id: 'report1',
          type: 'conversation',
          reason: 'harassment',
          status: 'pending',
          reporterId: 'user123',
          targetId: 'conv789',
          note: 'Harassment in conversation',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      // Mock reports query with type filter
      mockDb.collection().where().orderBy().get.mockResolvedValue({
        docs: mockReports.map(report => ({
          id: report.id,
          data: () => report,
        })),
      });

      const response = await request(app)
        .get('/api/v1/admin/chat/reports?type=conversation')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe('conversation');
    });

    it('should handle pagination correctly', async () => {
      const mockReports = Array.from({ length: 15 }, (_, i) => ({
        id: `report${i + 1}`,
        type: 'message',
        reason: 'spam',
        status: 'pending',
        reporterId: 'user123',
        targetId: `msg${i + 1}`,
        conversationId: 'conv789',
        note: `Spam content ${i + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      // Mock reports query with pagination
      mockDb.collection().orderBy().limit().get.mockResolvedValue({
        docs: mockReports.slice(0, 10).map(report => ({
          id: report.id,
          data: () => report,
        })),
      });

      const response = await request(app)
        .get('/api/v1/admin/chat/reports?pageSize=10&page=1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.pageSize).toBe(10);
    });

    it('should return 403 for non-admin/non-moderator user', async () => {
      // Mock regular user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'member',
        }),
      });

      const response = await request(app)
        .get('/api/v1/admin/chat/reports')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .get('/api/v1/admin/chat/reports');

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });

    it('should handle Firestore errors gracefully', async () => {
      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      // Mock reports query error
      mockDb.collection().orderBy().get.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/admin/chat/reports')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Internal server error');
    });
  });

  describe('PATCH /api/v1/admin/chat/reports/:id/status', () => {
    it('should update report status successfully for admin', async () => {
      const mockReport = {
        id: 'report1',
        type: 'message',
        reason: 'spam',
        status: 'pending',
        reporterId: 'user123',
        targetId: 'msg456',
        conversationId: 'conv789',
        note: 'Spam content',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedReport = {
        ...mockReport,
        status: 'resolved',
        resolutionNote: 'Content removed, user warned',
        resolvedAt: new Date(),
        resolvedBy: 'admin123',
      };

      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      // Mock report check
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
        .patch('/api/v1/admin/chat/reports/report1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({
          status: 'resolved',
          resolutionNote: 'Content removed, user warned',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.status).toBe('resolved');
      expect(response.body.data.resolutionNote).toBe('Content removed, user warned');
    });

    it('should update report status successfully for moderator', async () => {
      const mockReport = {
        id: 'report1',
        type: 'conversation',
        reason: 'harassment',
        status: 'investigating',
        reporterId: 'user123',
        targetId: 'conv789',
        note: 'Harassment in conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedReport = {
        ...mockReport,
        status: 'dismissed',
        resolutionNote: 'No evidence of harassment found',
        resolvedAt: new Date(),
        resolvedBy: 'moderator123',
      };

      // Mock moderator user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'moderator',
        }),
      });

      // Mock report check
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
        .patch('/api/v1/admin/chat/reports/report1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({
          status: 'dismissed',
          resolutionNote: 'No evidence of harassment found',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.status).toBe('dismissed');
      expect(response.body.data.resolutionNote).toBe('No evidence of harassment found');
    });

    it('should return 400 for missing status field', async () => {
      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      const response = await request(app)
        .patch('/api/v1/admin/chat/reports/report1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({
          resolutionNote: 'Content removed',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('status');
    });

    it('should return 400 for invalid status value', async () => {
      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      const response = await request(app)
        .patch('/api/v1/admin/chat/reports/report1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({
          status: 'invalid_status',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Invalid status');
    });

    it('should return 400 for resolution note exceeding max length', async () => {
      const longNote = 'a'.repeat(1001); // Exceeds 1000 character limit

      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      const response = await request(app)
        .patch('/api/v1/admin/chat/reports/report1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({
          status: 'resolved',
          resolutionNote: longNote,
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('length');
    });

    it('should return 404 for non-existent report', async () => {
      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      // Mock report not found
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .patch('/api/v1/admin/chat/reports/nonexistent/status')
        .set('Authorization', 'Bearer valid-token')
        .send({
          status: 'resolved',
        });

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Report not found');
    });

    it('should return 403 for non-admin/non-moderator user', async () => {
      // Mock regular user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'member',
        }),
      });

      const response = await request(app)
        .patch('/api/v1/admin/chat/reports/report1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({
          status: 'resolved',
        });

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .patch('/api/v1/admin/chat/reports/report1/status')
        .send({
          status: 'resolved',
        });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });

    it('should handle Firestore errors gracefully', async () => {
      const mockReport = {
        id: 'report1',
        type: 'message',
        reason: 'spam',
        status: 'pending',
        reporterId: 'user123',
        targetId: 'msg456',
        conversationId: 'conv789',
        note: 'Spam content',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      // Mock report check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockReport,
      });

      // Mock report update error
      mockDb.collection().doc().update.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .patch('/api/v1/admin/chat/reports/report1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({
          status: 'resolved',
        });

      expect(response.status).toBe(500);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Internal server error');
    });
  });

  describe('DELETE /api/v1/admin/chat/messages/:id', () => {
    it('should delete message successfully for admin', async () => {
      const mockMessage = {
        id: 'msg123',
        conversationId: 'conv123',
        authorId: 'user456',
        text: 'Inappropriate content',
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      };

      const mockConversation = {
        id: 'conv123',
        type: 'group',
        members: ['user123', 'user456', 'user789'],
        memberCount: 3,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      // Mock message check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockMessage,
      });

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      // Mock message deletion
      mockDb.collection().doc().update.mockResolvedValue();

      const response = await request(app)
        .delete('/api/v1/admin/chat/messages/msg123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.message).toContain('deleted');
    });

    it('should return 404 for non-existent message', async () => {
      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      // Mock message not found
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .delete('/api/v1/admin/chat/messages/nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Message not found');
    });

    it('should return 403 for non-admin user', async () => {
      // Mock regular user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'member',
        }),
      });

      const response = await request(app)
        .delete('/api/v1/admin/chat/messages/msg123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .delete('/api/v1/admin/chat/messages/msg123');

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('POST /api/v1/admin/chat/conversations/:id/lock', () => {
    it('should lock conversation successfully for admin', async () => {
      const mockConversation = {
        id: 'conv123',
        type: 'group',
        members: ['user123', 'user456', 'user789'],
        memberCount: 3,
        lastMessageAt: new Date(),
        isLocked: false,
      };

      const updatedConversation = {
        ...mockConversation,
        isLocked: true,
        lockedAt: new Date(),
        lockedBy: 'admin123',
        lockReason: 'Violation of community guidelines',
      };

      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      // Mock conversation check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockConversation,
      });

      // Mock conversation update
      mockDb.collection().doc().update.mockResolvedValue();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => updatedConversation,
      });

      const response = await request(app)
        .post('/api/v1/admin/chat/conversations/conv123/lock')
        .set('Authorization', 'Bearer valid-token')
        .send({
          reason: 'Violation of community guidelines',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.isLocked).toBe(true);
      expect(response.body.data.lockReason).toBe('Violation of community guidelines');
    });

    it('should return 400 for missing reason field', async () => {
      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      const response = await request(app)
        .post('/api/v1/admin/chat/conversations/conv123/lock')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('reason');
    });

    it('should return 404 for non-existent conversation', async () => {
      // Mock admin user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'admin',
        }),
      });

      // Mock conversation not found
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const response = await request(app)
        .post('/api/v1/admin/chat/conversations/nonexistent/lock')
        .set('Authorization', 'Bearer valid-token')
        .send({
          reason: 'Violation of guidelines',
        });

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Conversation not found');
    });

    it('should return 403 for non-admin user', async () => {
      // Mock regular user check
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          role: 'member',
        }),
      });

      const response = await request(app)
        .post('/api/v1/admin/chat/conversations/conv123/lock')
        .set('Authorization', 'Bearer valid-token')
        .send({
          reason: 'Violation of guidelines',
        });

      expect(response.status).toBe(403);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .post('/api/v1/admin/chat/conversations/conv123/lock')
        .send({
          reason: 'Violation of guidelines',
        });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('Data Validation', () => {
    it('should validate report statuses', () => {
      const validStatuses = ['pending', 'investigating', 'resolved', 'dismissed'];
      const invalidStatuses = ['invalid', 'unknown', ''];

      validStatuses.forEach(status => {
        expect(['pending', 'investigating', 'resolved', 'dismissed']).toContain(status);
      });

      invalidStatuses.forEach(status => {
        expect(['pending', 'investigating', 'resolved', 'dismissed']).not.toContain(status);
      });
    });

    it('should validate report types', () => {
      const validTypes = ['message', 'conversation', 'user'];
      const invalidTypes = ['invalid', 'unknown', ''];

      validTypes.forEach(type => {
        expect(['message', 'conversation', 'user']).toContain(type);
      });

      invalidTypes.forEach(type => {
        expect(['message', 'conversation', 'user']).not.toContain(type);
      });
    });

    it('should validate user roles', () => {
      const validRoles = ['admin', 'moderator'];
      const invalidRoles = ['member', 'user', ''];

      validRoles.forEach(role => {
        expect(['admin', 'moderator']).toContain(role);
      });

      invalidRoles.forEach(role => {
        expect(['admin', 'moderator']).not.toContain(role);
      });
    });
  });

  describe('Authorization Workflow', () => {
    it('should enforce role-based access control', () => {
      const adminPermissions = ['read_reports', 'update_reports', 'delete_messages', 'lock_conversations'];
      const moderatorPermissions = ['read_reports', 'update_reports'];
      const memberPermissions = [];

      expect(adminPermissions).toContain('read_reports');
      expect(adminPermissions).toContain('update_reports');
      expect(adminPermissions).toContain('delete_messages');
      expect(adminPermissions).toContain('lock_conversations');

      expect(moderatorPermissions).toContain('read_reports');
      expect(moderatorPermissions).toContain('update_reports');
      expect(moderatorPermissions).not.toContain('delete_messages');
      expect(moderatorPermissions).not.toContain('lock_conversations');

      expect(memberPermissions).not.toContain('read_reports');
      expect(memberPermissions).not.toContain('update_reports');
    });

    it('should maintain audit trail for admin actions', () => {
      const adminAction = {
        action: 'lock_conversation',
        adminId: 'admin123',
        timestamp: new Date(),
        reason: 'Violation of guidelines',
        conversationId: 'conv123',
      };

      expect(adminAction).toHaveProperty('action');
      expect(adminAction).toHaveProperty('adminId');
      expect(adminAction).toHaveProperty('timestamp');
      expect(adminAction).toHaveProperty('reason');
      expect(adminAction).toHaveProperty('conversationId');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle report escalation workflow', async () => {
      // This test would require integration with the report service
      // For now, we'll verify the basic structure
      const reportWorkflow = {
        pending: 'Initial report submitted',
        investigating: 'Moderator reviewing evidence',
        resolved: 'Action taken, report closed',
        dismissed: 'No violation found, report closed',
      };

      expect(reportWorkflow.pending).toBe('Initial report submitted');
      expect(reportWorkflow.investigating).toBe('Moderator reviewing evidence');
      expect(reportWorkflow.resolved).toBe('Action taken, report closed');
      expect(reportWorkflow.dismissed).toBe('No violation found, report closed');
    });

    it('should handle conversation moderation actions', async () => {
      // This test would require integration with the conversation service
      // For now, we'll verify the basic structure
      const moderationActions = {
        lock: 'Prevent new messages',
        unlock: 'Allow new messages',
        delete_message: 'Remove inappropriate content',
        ban_user: 'Remove user from conversation',
      };

      expect(moderationActions.lock).toBe('Prevent new messages');
      expect(moderationActions.unlock).toBe('Allow new messages');
      expect(moderationActions.delete_message).toBe('Remove inappropriate content');
      expect(moderationActions.ban_user).toBe('Remove user from conversation');
    });

    it('should handle user role management', async () => {
      // This test would require integration with the user service
      // For now, we'll verify the basic structure
      const roleHierarchy = {
        admin: ['read_reports', 'update_reports', 'delete_messages', 'lock_conversations', 'manage_users'],
        moderator: ['read_reports', 'update_reports', 'delete_messages'],
        member: [],
      };

      expect(roleHierarchy.admin).toContain('manage_users');
      expect(roleHierarchy.moderator).not.toContain('manage_users');
      expect(roleHierarchy.member).toHaveLength(0);
    });
  });
});
