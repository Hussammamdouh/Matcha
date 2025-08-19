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
    './src/modules/admin/routes.js',
    './src/routes/health.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
