/*
 End-to-end Chat test:
 - Users: user1@example.com, user2@example.com, user3@example (same password: Password!123)
 - Flow:
   1) Login all 3 users; fetch profiles (uids)
   2) Direct conversation between user1 & user2; exchange messages; delete a message
   3) Group conversation created by user1 with user2 & user3; send messages
   4) Add reactions; remove reactions
   5) Delete a message with media (skipped upload; we simulate URL-based media if accepted)
   6) Delete entire conversation (owner)
*/

const axios = require('axios').default;

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';

function log(step, data) {
  const time = new Date().toISOString();
  console.log(`[${time}] ${step}:`, data || 'OK');
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

async function login(email, password) {
  const res = await axios.post(`${BASE_URL}/api/v1/auth/login`, { email, password });
  if (!res.data?.ok) throw new Error('Login failed');
  return res.data.data.idToken;
}

async function register(email, password, nickname) {
  const res = await axios.post(`${BASE_URL}/api/v1/auth/register-email`, { email, password, nickname });
  if (!(res.status === 201 && res.data?.ok)) throw new Error('Register failed');
  return true;
}

async function ensureLogin(email, password, nickname) {
  try {
    return await login(email, password);
  } catch (e) {
    // Try to register then login
    await register(email, password, nickname);
    return await login(email, password);
  }
}

function normalizeEmailIfNeeded(email) {
  // If email lacks a TLD, append .com for testing purposes
  if (/^[^@]+@[^@]+$/.test(email)) {
    return `${email}.com`;
  }
  return email;
}

function client(idToken) {
  return axios.create({ baseURL: BASE_URL, headers: { Authorization: `Bearer ${idToken}` }, validateStatus: () => true });
}

async function getMe(c) {
  const res = await c.get('/api/v1/me');
  if (res.status !== 200 || !res.data.ok) throw new Error('Get profile failed');
  return res.data.data;
}

async function main() {
  const pwd = 'Password!123';
  const users = [
    { email: 'user1@example.com', password: pwd },
    { email: 'user2@example.com', password: pwd },
    { email: 'user3@example', password: pwd },
  ];

  // Login
  log('Login users');
  const tokens = await Promise.all(users.map((u, i) => ensureLogin(normalizeEmailIfNeeded(u.email), u.password, `chat_user_${i+1}`)));
  const [c1, c2, c3] = tokens.map(t => client(t));
  await sleep(300);

  // Profiles
  log('Fetch profiles');
  const [u1, u2, u3] = await Promise.all([getMe(c1), getMe(c2), getMe(c3)]);
  log('Users', { u1: u1.uid, u2: u2.uid, u3: u3.uid });
  await sleep(300);

  // 1) Direct conversation user1 <-> user2
  log('Create direct conversation (u1<->u2)');
  let directId = null;
  {
    const res = await c1.post('/api/v1/chat/conversations', {
      type: 'direct',
      memberUserIds: [u2.uid],
    });
    if (res.status !== 201 || !res.data.ok) throw new Error(`Create direct conversation failed: ${res.status}`);
    directId = res.data.data.id || res.data.data.conversationId || res.data.data?.conversation?.id || res.data.data?.id;
    if (!directId && res.data.data) directId = res.data.data.id;
    if (!directId) throw new Error('Missing direct conversation id');
    log('Direct conversation created', { directId });
  }
  await sleep(300);

  // Send messages
  log('Send messages direct');
  let msg1Id = null;
  {
    const m1 = await c1.post('/api/v1/chat/messages', { conversationId: directId, type: 'text', text: 'Hi u2!' });
    if (m1.status !== 201 || !m1.data.ok) throw new Error(`Send msg1 failed: ${m1.status}`);
    msg1Id = m1.data.data.id;
    await sleep(250);
    const m2 = await c2.post('/api/v1/chat/messages', { conversationId: directId, type: 'text', text: 'Hello u1!' });
    if (m2.status !== 201 || !m2.data.ok) throw new Error(`Send msg2 failed: ${m2.status}`);
  }
  await sleep(300);

  // Reaction add/remove
  log('Add reaction to msg1');
  {
    const r1 = await c2.post(`/api/v1/chat/messages/${msg1Id}/reactions`, { value: '👍' });
    if (r1.status !== 201 || !r1.data.ok) throw new Error(`Add reaction failed: ${r1.status}`);
    await sleep(200);
    const r2 = await c2.delete(`/api/v1/chat/messages/${msg1Id}/reactions/%F0%9F%91%8D`);
    if (r2.status !== 200 || !r2.data.ok) throw new Error(`Remove reaction failed: ${r2.status}`);
  }
  await sleep(300);

  // Delete a message
  log('Delete message by author');
  {
    const del = await c1.delete(`/api/v1/chat/messages/${msg1Id}`);
    if (del.status !== 200 || !del.data.ok) throw new Error(`Delete message failed: ${del.status}`);
  }
  await sleep(300);

  // 2) Group conversation user1 with user2 & user3
  log('Create group conversation');
  let groupId = null;
  {
    const res = await c1.post('/api/v1/chat/conversations', {
      type: 'group',
      title: `E2E Group ${Date.now()}`,
      memberUserIds: [u2.uid, u3.uid],
    });
    if (res.status !== 201 || !res.data.ok) throw new Error(`Create group conversation failed: ${res.status}`);
    groupId = res.data.data.id || res.data.data.conversationId || res.data.data?.id;
    if (!groupId) throw new Error('Missing group conversation id');
    log('Group conversation created', { groupId });
  }
  await sleep(300);

  // Send messages to group
  log('Send messages to group');
  let gMsgId = null;
  {
    const g1 = await c1.post('/api/v1/chat/messages', { conversationId: groupId, type: 'text', text: 'Welcome to the group' });
    if (g1.status !== 201 || !g1.data.ok) throw new Error(`Send group msg1 failed: ${g1.status}`);
    gMsgId = g1.data.data.id;
    await sleep(250);
    const g2 = await c3.post('/api/v1/chat/messages', { conversationId: groupId, type: 'text', text: 'Hi all!' });
    if (g2.status !== 201 || !g2.data.ok) throw new Error(`Send group msg2 failed: ${g2.status}`);
  }
  await sleep(300);

  // Send an image message with a direct URL (simulates pre-hosted media)
  // If your server validates mime/size strictly for chat, this still passes since chat expects media object with url/mime/size
  log('Send media message to group (URL)');
  let mediaMsgId = null;
  {
    const imgUrl = 'https://storage.googleapis.com/example-bucket/public/sample.jpg';
    const m = await c2.post('/api/v1/chat/messages', {
      conversationId: groupId,
      type: 'image',
      media: { url: imgUrl, mime: 'image/jpeg', size: 12345, width: 800, height: 600 },
    });
    if (m.status !== 201 || !m.data.ok) throw new Error(`Send media message failed: ${m.status}`);
    mediaMsgId = m.data.data.id;
  }
  await sleep(300);

  // Delete the media message (should trigger media cleanup best-effort)
  log('Delete media message');
  {
    const del = await c2.delete(`/api/v1/chat/messages/${mediaMsgId}`);
    if (del.status !== 200 || !del.data.ok) throw new Error(`Delete media message failed: ${del.status}`);
  }
  await sleep(300);

  // Group reaction
  log('Group reaction add/remove');
  {
    const r1 = await c2.post(`/api/v1/chat/messages/${gMsgId}/reactions`, { value: '🎉' });
    if (r1.status !== 201 || !r1.data.ok) throw new Error(`Add group reaction failed: ${r1.status}`);
    await sleep(200);
    const r2 = await c2.delete(`/api/v1/chat/messages/${gMsgId}/reactions/%F0%9F%8E%89`);
    if (r2.status !== 200 || !r2.data.ok) throw new Error(`Remove group reaction failed: ${r2.status}`);
  }
  await sleep(300);

  // Delete entire conversation (owner)
  log('Delete group conversation (owner)');
  {
    const del = await c1.delete(`/api/v1/chat/conversations/${groupId}`);
    if (del.status !== 200 || !del.data.ok) throw new Error(`Delete conversation failed: ${del.status}`);
  }

  log('E2E Chat test completed successfully');
}

main().catch(err => {
  console.error('E2E chat test failed:', err.response?.status, err.response?.data || err.message);
  process.exit(1);
});


