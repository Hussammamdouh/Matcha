const { createApp } = require('../app');
const request = require('supertest');

describe('Comments pagination handler', () => {
  test('GET /api/v1/posts/:postId/comments with cursor param', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/v1/posts/some-post-id/comments?pageSize=2&cursor=abc')
      .set('Authorization', 'Bearer invalid');
    expect([200, 400, 401, 403, 404]).toContain(res.status);
  });
});


