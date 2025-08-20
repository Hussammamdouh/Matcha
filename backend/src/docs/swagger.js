const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Matcha Backend API',
      version: '1.0.0',
      description: 'API documentation for Matcha - Women-only anonymous social application backend',
      contact: {
        name: 'Matcha Team',
        email: 'support@matcha.app',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Development server',
      },
      {
        url: 'https://api.matcha.app',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Firebase ID token for authentication',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Error code',
              example: 'AUTH_INVALID_TOKEN',
            },
            message: {
              type: 'string',
              description: 'Error message',
              example: 'Invalid or expired token',
            },
            details: {
              type: 'string',
              description: 'Additional error details (development only)',
            },
          },
          required: ['code', 'message'],
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            ok: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
            error: {
              type: 'null',
              example: null,
            },
            meta: {
              type: 'object',
              properties: {
                requestId: {
                  type: 'string',
                  description: 'Unique request identifier',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
          required: ['ok', 'data', 'error'],
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            ok: {
              type: 'boolean',
              example: false,
            },
            data: {
              type: 'null',
              example: null,
            },
            error: {
              $ref: '#/components/schemas/Error',
            },
            meta: {
              type: 'object',
              properties: {
                requestId: {
                  type: 'string',
                  description: 'Unique request identifier',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
          required: ['ok', 'data', 'error'],
        },
        // Chat-specific schemas
        ChatMessage: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Message ID',
            },
            conversationId: {
              type: 'string',
              description: 'Conversation ID',
            },
            type: {
              type: 'string',
              enum: ['text', 'image', 'audio'],
              description: 'Message type',
            },
            text: {
              type: 'string',
              description: 'Message text (for text messages)',
            },
            media: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                mime: { type: 'string' },
                size: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' },
                durationMs: { type: 'number' },
              },
              description: 'Media information (for media messages)',
            },
            author: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                nickname: { type: 'string' },
                avatarUrl: { type: 'string' },
              },
              description: 'Author information',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Message creation timestamp',
            },
            editedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Message edit timestamp',
            },
            isDeleted: {
              type: 'boolean',
              description: 'Whether message is deleted',
            },
            replyToMessageId: {
              type: 'string',
              description: 'ID of message being replied to',
            },
          },
          required: ['id', 'conversationId', 'type', 'author', 'createdAt'],
        },
        ChatConversation: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Conversation ID',
            },
            type: {
              type: 'string',
              enum: ['direct', 'group'],
              description: 'Conversation type',
            },
            title: {
              type: 'string',
              description: 'Conversation title (for groups)',
            },
            icon: {
              type: 'string',
              description: 'Conversation icon URL',
            },
            members: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  nickname: { type: 'string' },
                  avatarUrl: { type: 'string' },
                  role: { type: 'string', enum: ['member', 'moderator', 'owner'] },
                },
              },
              description: 'Conversation participants',
            },
            lastMessageAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp of last message',
            },
            lastMessagePreview: {
              type: 'string',
              description: 'Preview of last message',
            },
            memberCount: {
              type: 'number',
              description: 'Number of participants',
            },
            isLocked: {
              type: 'boolean',
              description: 'Whether conversation is locked',
            },
          },
          required: ['id', 'type', 'members', 'lastMessageAt', 'memberCount'],
        },
        ChatReport: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Report ID',
            },
            type: {
              type: 'string',
              enum: ['message', 'conversation', 'user'],
              description: 'Report type',
            },
            targetId: {
              type: 'string',
              description: 'ID of reported target',
            },
            conversationId: {
              type: 'string',
              description: 'Conversation ID (if applicable)',
            },
            reasonCode: {
              type: 'string',
              enum: ['spam', 'harassment', 'inappropriate_content', 'violence', 'fake_news', 'copyright', 'other'],
              description: 'Reason for report',
            },
            status: {
              type: 'string',
              enum: ['new', 'in_review', 'resolved', 'dismissed'],
              description: 'Report status',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Report creation timestamp',
            },
          },
          required: ['id', 'type', 'targetId', 'reasonCode', 'status', 'createdAt'],
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
          tags: [
        {
          name: 'Authentication',
          description: 'User authentication and authorization endpoints',
        },
        {
          name: 'User Profile',
          description: 'User profile management endpoints',
        },
        {
          name: 'KYC Verification',
          description: 'Know Your Customer verification endpoints',
        },
        {
          name: 'Chat',
          description: 'Chat system endpoints (conversations, messages, presence)',
        },
        {
          name: 'Chat Moderation',
          description: 'Chat moderation and safety features',
        },
        {
          name: 'Storage',
          description: 'File upload and media management endpoints',
        },
        {
          name: 'Admin',
          description: 'Administrative endpoints (admin/moderator only)',
        },
        {
          name: 'Health',
          description: 'Health check and monitoring endpoints',
        },
      ],
  },
      apis: [
      './src/modules/auth/routes.js',
      './src/modules/users/routes.js',
      './src/modules/verification/routes.js',
      './src/modules/chat/routes.js',
      './src/modules/chat/conversations/routes.js',
      './src/modules/chat/messages/routes.js',
      './src/modules/chat/blocks/routes.js',
      './src/modules/chat/reports/routes.js',
      './src/modules/chat/admin/routes.js',
      './src/modules/storage/routes.js',
      './src/modules/admin/routes.js',
      './src/routes/health.js',
    ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
