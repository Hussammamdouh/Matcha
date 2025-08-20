const request = require('supertest');
const { createApp } = require('../app');

describe('Authentication Endpoints', () => {
  let app;

  beforeAll(async () => {
    app = createApp();
  });

  describe('POST /api/v1/auth/register-email', () => {
    it('should return 400 for invalid email', async () => {
      const response = await request(app).post('/api/v1/auth/register-email').send({
        email: 'invalid-email',
        password: 'password123',
        nickname: 'testuser',
      });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for short password', async () => {
      const response = await request(app).post('/api/v1/auth/register-email').send({
        email: 'test@example.com',
        password: '123',
        nickname: 'testuser',
      });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid nickname', async () => {
      const response = await request(app).post('/api/v1/auth/register-email').send({
        email: 'test@example.com',
        password: 'password123',
        nickname: 'a',
      });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Health Check Endpoints', () => {
    it('should return 200 for /healthz', async () => {
      const response = await request(app).get('/healthz');
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.status).toBe('healthy');
    });

    it('should return 200 for /readyz', async () => {
      const response = await request(app).get('/readyz');
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.status).toBe('ready');
    });
  });
});
