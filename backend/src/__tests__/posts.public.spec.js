const request = require('supertest');
const { createApp } = require('../app');

describe('Public posts + toggles', () => {
  let app;
  const testUser = 'test_user_posts';

  beforeAll(() => {
    app = createApp();
  });

  it('creates a public post and fetches it', async () => {
    const createRes = await request(app)
      .post('/api/v1/posts')
      .set('X-Test-User-Id', testUser)
      .send({ title: 'Hello', body: 'World', visibility: 'public' })
      .expect(201);

    const postId = createRes.body.data.id;
    expect(postId).toBeTruthy();

    const getRes = await request(app).get(`/api/v1/posts/${postId}`).expect(200);
    expect(getRes.body.ok).toBe(true);
    expect(getRes.body.data.title).toBe('Hello');
  });

  it('toggles like and save', async () => {
    const { body } = await request(app)
      .post('/api/v1/posts')
      .set('X-Test-User-Id', testUser)
      .send({ title: 'Toggle', body: 'Test', visibility: 'public' })
      .expect(201);
    const id = body.data.id;

    const like1 = await request(app)
      .post(`/api/v1/posts/${id}/toggle-like`)
      .set('X-Test-User-Id', testUser)
      .expect(200);
    expect(like1.body.data.liked).toBe(true);

    const like2 = await request(app)
      .post(`/api/v1/posts/${id}/toggle-like`)
      .set('X-Test-User-Id', testUser)
      .expect(200);
    expect(like2.body.data.liked).toBe(false);

    const save1 = await request(app)
      .post(`/api/v1/posts/${id}/toggle-save`)
      .set('X-Test-User-Id', testUser)
      .expect(200);
    expect(save1.body.ok).toBe(true);
  });
});


