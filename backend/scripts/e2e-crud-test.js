/*
 End-to-end CRUD test for Communities, Posts, Comments, Replies, and Moderation
 - Uses two users: user1@example.com and user2@example.com (Password!123)
 - Hits the running backend on http://localhost:8080
 - Sequence:
   1) Login both users
   2) user1 creates a community
   3) user2 joins the community
   4) user1 assigns user2 as moderator
   5) user2 creates a post in the community
   6) user1 creates a public post
   7) user2 comments on user1's public post; user1 deletes that comment (allowed by policy)
   8) user1 comments on community post; user2 (moderator) deletes that comment (allowed)
   9) Create a reply to a comment and delete via owner/mod
  10) user2 deletes their own community post (allowed as author)
  11) user1 deletes the community (owner or platform admin)
*/

const axios = require('axios').default;

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';

function log(step, data) {
  const time = new Date().toISOString();
  console.log(`[${time}] ${step}:`, data || 'OK');
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function login(email, password) {
  const url = `${BASE_URL}/api/v1/auth/login`;
  const res = await axios.post(url, { email, password });
  if (!res.data?.ok) throw new Error('Login failed');
  return res.data.data.idToken;
}

function client(idToken) {
  const instance = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${idToken}` },
    validateStatus: () => true,
  });
  return instance;
}

async function main() {
  const user1 = { email: 'user1@example.com', password: 'Password!123' };
  const user2 = { email: 'user2@example.com', password: 'Password!123' };

  log('Login user1');
  const token1 = await login(user1.email, user1.password);
  const c1 = client(token1);

  log('Login user2');
  const token2 = await login(user2.email, user2.password);
  const c2 = client(token2);

  // Fetch user profiles to get stable userIds (uid)
  log('Fetch user1 profile');
  const u1Profile = await c1.get('/api/v1/me');
  if (u1Profile.status !== 200 || !u1Profile.data.ok) throw new Error('Fetch user1 profile failed');
  const user1Id = u1Profile.data.data.uid;

  log('Fetch user2 profile');
  const u2Profile = await c2.get('/api/v1/me');
  if (u2Profile.status !== 200 || !u2Profile.data.ok) throw new Error('Fetch user2 profile failed');
  const user2Id = u2Profile.data.data.uid;

  // 1) Create community (user1)
  log('Create community');
  const communityName = `Test Community ${Date.now()}`;
  let communityId = null;
  {
    const res = await c1.post('/api/v1/communities', {
      name: communityName,
      slug: `test-community-${Date.now()}`,
      category: 'test',
      description: 'E2E test community',
      isPrivate: false,
    });
    if (res.status !== 201 || !res.data.ok) throw new Error(`Create community failed: ${res.status}`);
    communityId = res.data.data.id;
    log('Community created', { communityId });
  }

  // 2) user2 joins community
  log('User2 join community');
  {
    const res = await c2.post(`/api/v1/communities/${communityId}/join`);
    if (res.status !== 201 || !res.data.ok) throw new Error(`Join community failed: ${res.status}`);
  }

  // 3) user1 assigns moderator user2
  log('Assign user2 as moderator');
  {
    // POST /api/v1/communities/:id/moderators with body { userId }
    const res = await c1.post(`/api/v1/communities/${communityId}/moderators`, { userId: user2Id });
    if (!(res.status === 201 && res.data.ok)) {
      log('Assign moderator response', { status: res.status, data: res.data });
    }
  }

  // 4) user2 creates a post in the community
  log('User2 creates community post');
  let communityPostId = null;
  {
    const res = await c2.post('/api/v1/posts', {
      communityId,
      visibility: 'community',
      title: 'Community Post',
      body: 'Hello community!',
      media: [],
    });
    if (res.status !== 201 || !res.data.ok) throw new Error(`Create community post failed: ${res.status}`);
    communityPostId = res.data.data.id;
    log('Community post created', { communityPostId });
  }

  // 5) user1 creates a public post
  log('User1 creates public post');
  let publicPostId = null;
  {
    const res = await c1.post('/api/v1/posts', {
      visibility: 'public',
      title: 'Public Post',
      body: 'Hello world!',
    });
    if (res.status !== 201 || !res.data.ok) throw new Error(`Create public post failed: ${res.status}`);
    publicPostId = res.data.data.id;
    log('Public post created', { publicPostId });
  }

  // 6) user2 comments on user1's public post; user1 deletes that comment
  log("User2 comments on user1's public post");
  let commentOnPublicId = null;
  {
    const res = await c2.post(`/api/v1/posts/${publicPostId}/comments`, { body: 'Nice post!' });
    if (res.status !== 201 || !res.data.ok) throw new Error(`Create comment failed: ${res.status}`);
    commentOnPublicId = res.data.data.id;
  }
  log('User1 deletes comment on own post');
  {
    const res = await c1.delete(`/api/v1/posts/${publicPostId}/comments/${commentOnPublicId}`);
    if (res.status !== 200 || !res.data.ok) throw new Error(`Delete comment by post author failed: ${res.status}`);
  }

  // 7) user1 comments on community post; user2 (moderator) deletes that comment
  log('User1 comments on community post');
  let commentInCommunityId = null;
  {
    const res = await c1.post(`/api/v1/posts/${communityPostId}/comments`, { body: 'Moderate me if you can' });
    if (res.status !== 201 || !res.data.ok) throw new Error(`Create community comment failed: ${res.status}`);
    commentInCommunityId = res.data.data.id;
  }
  log('User2 (mod) deletes comment in community');
  {
    const res = await c2.delete(`/api/v1/posts/${communityPostId}/comments/${commentInCommunityId}`);
    if (res.status !== 200 || !res.data.ok) throw new Error(`Community moderator delete comment failed: ${res.status}`);
  }

  // 8) Create a reply to a comment and delete via owner/mod
  log('Create thread: user2 comments, user1 replies, then user2 deletes reply as mod');
  let baseCommentId = null;
  let replyId = null;
  {
    const cmt = await c2.post(`/api/v1/posts/${communityPostId}/comments`, { body: 'Base comment' });
    if (cmt.status !== 201 || !cmt.data.ok) throw new Error(`Create base comment failed: ${cmt.status}`);
    baseCommentId = cmt.data.data.id;

    const reply = await c1.post(`/api/v1/posts/${communityPostId}/comments`, { body: 'Replying...', parentId: baseCommentId });
    if (reply.status !== 201 || !reply.data.ok) throw new Error(`Create reply failed: ${reply.status}`);
    replyId = reply.data.data.id;

    const delReply = await c2.delete(`/api/v1/posts/${communityPostId}/comments/${replyId}`);
    if (delReply.status !== 200 || !delReply.data.ok) throw new Error(`Moderator delete reply failed: ${delReply.status}`);
  }

  // 9) user2 deletes their own community post
  log('User2 deletes own community post');
  {
    const res = await c2.delete(`/api/v1/posts/${communityPostId}`);
    if (res.status !== 200 || !res.data.ok) throw new Error(`Delete post failed: ${res.status}`);
  }

  // 10) user1 deletes the community
  log('User1 deletes community');
  {
    const res = await c1.delete(`/api/v1/communities/${communityId}`);
    if (res.status !== 200 || !res.data.ok) throw new Error(`Delete community failed: ${res.status}`);
  }

  log('E2E CRUD test completed successfully');
}

// no-op utility retained for compatibility
function resUserIdFromEmail(email) { return email; }

main().catch(async (err) => {
  console.error('E2E test failed:', err.response?.status, err.response?.data || err.message);
  // Allow logs to flush
  await sleep(100);
  process.exit(1);
});


