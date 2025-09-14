const request = require('supertest');
const { createApp } = require('../app');

describe('Profile stats, likes, saves, follow', () => {
  let app;
  const u1 = 'test_user_u1';
  const u2 = 'test_user_u2';

  beforeAll(() => {
    app = createApp();
  });

  it('follows and lists following/followers', async () => {
    await request(app).post(`/api/v1/me/follow/${u2}`).set('X-Test-User-Id', u1).expect(200);

    const following = await request(app).get('/api/v1/me/following').set('X-Test-User-Id', u1).expect(200);
    expect(following.body.data.following).toEqual(expect.arrayContaining([u2]));

    const followers = await request(app).get('/api/v1/me/followers').set('X-Test-User-Id', u2).expect(200);
    expect(followers.body.data.followers).toEqual(expect.arrayContaining([u1]));
  });

  it('profile stats and lists liked/saved posts', async () => {
    const postRes = await request(app)
      .post('/api/v1/posts')
      .set('X-Test-User-Id', u1)
      .send({ title: 'P1', body: 'B1', visibility: 'public' })
      .expect(201);
    const id = postRes.body.data.id;

    await request(app).post(`/api/v1/posts/${id}/toggle-like`).set('X-Test-User-Id', u1).expect(200);
    await request(app).post(`/api/v1/posts/${id}/toggle-save`).set('X-Test-User-Id', u1).expect(200);

    const stats = await request(app).get('/api/v1/me/stats').set('X-Test-User-Id', u1).expect(200);
    expect(stats.body.data.stats.posts).toBeGreaterThanOrEqual(1);

    const likes = await request(app).get('/api/v1/me/likes').set('X-Test-User-Id', u1).expect(200);
    expect(Array.isArray(likes.body.data)).toBe(true);

    const saves = await request(app).get('/api/v1/me/saves').set('X-Test-User-Id', u1).expect(200);
    expect(Array.isArray(saves.body.data)).toBe(true);
  });
});


