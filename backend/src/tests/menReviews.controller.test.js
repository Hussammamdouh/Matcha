const request = require('supertest');
const { createApp } = require('../app');

describe('GET /api/v1/reviews/aggregate', () => {
  test('requires auth', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/reviews/aggregate');
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });
});


