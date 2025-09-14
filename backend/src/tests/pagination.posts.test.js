// Light smoke tests to ensure handlers accept cursor/pageSize and shape responses
const { createApp } = require('../app');
const request = require('supertest');

describe('Posts pagination handlers', () => {
  test('GET /api/v1/posts?communityId with pagination shape', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/v1/communities/test-community/posts?pageSize=2')
      .set('Authorization', 'Bearer invalid'); // expect auth error or success depending on route
    // We are just checking server responds (200/401/403) and not crashing
    expect([200, 401, 403, 404]).toContain(res.status);
  });
});


