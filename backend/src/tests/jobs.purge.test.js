const request = require('supertest');
const { createApp } = require('../app');

describe('POST /api/v1/jobs/purge-men-originals', () => {
  test('accepts request and returns 202', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/jobs/purge-men-originals');
    expect(res.status).toBe(202);
    expect(res.body.ok).toBe(true);
  });
});


