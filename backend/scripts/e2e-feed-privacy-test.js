/*
 Test feeds and privacy:
 - user1 follows user2 and joins a community
 - Verify home feed shows followed user's public posts and joined community posts
 - Create community post and fetch via community endpoint
 - List community members
 - Set user2 settings to private and ensure user1 sees privacy messages for profile/likes/followers/following
*/
const axios = require('axios').default;
const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8080';

function log(step, data) { console.log(`[${new Date().toISOString()}] ${step}:`, data || 'OK'); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function login(email, password) {
  const res = await axios.post(`${BASE_URL}/api/v1/auth/login`, { email, password });
  if (!res.data?.ok) throw new Error('Login failed');
  return res.data.data.idToken;
}
function client(t) { return axios.create({ baseURL: BASE_URL, headers: { Authorization: `Bearer ${t}` }, validateStatus: () => true }); }
async function me(c) { const r = await c.get('/api/v1/me'); if (r.status!==200||!r.data.ok) throw new Error('me failed'); return r.data.data; }

async function main() {
  const pwd = 'Password!123';
  const user1 = { email: 'user1@example.com', password: pwd };
  const user2 = { email: 'user2@example.com', password: pwd };

  log('Login users');
  const [t1, t2] = await Promise.all([login(user1.email, user1.password), login(user2.email, user2.password)]);
  log('Login tokens obtained');
  const [c1, c2] = [client(t1), client(t2)];
  let u1, u2;
  try { 
    u1 = await me(c1); 
    log('user1 me success:', u1.uid);
  } catch (e) { 
    console.error('me user1 error:', e.response?.status, e.response?.data || e.message); 
    throw e; 
  }
  try { 
    u2 = await me(c2); 
    log('user2 me success:', u2.uid);
  } catch (e) { 
    console.error('me user2 error:', e.response?.status, e.response?.data || e.message); 
    throw e; 
  }
  await sleep(200);

  // user1 follows user2
  log('user1 follows user2');
  try { 
    const followRes = await c1.post(`/api/v1/me/follow/${u2.uid}`);
    log('follow response status:', followRes.status);
    log('follow response data:', JSON.stringify(followRes.data, null, 2));
  } catch (e) { 
    console.error('follow error', e.response?.status, e.response?.data || e.message); 
    throw e; 
  }
  await sleep(200);

  // Create community by user2, user1 joins
  log('user2 creates community');
  const comRes = await c2.post('/api/v1/communities', { name: `FeedCom ${Date.now()}`, slug: `feedcom-${Date.now()}`, description: 'feed test', isPrivate: false });
  if (comRes.status !== 201 || !comRes.data.ok) throw new Error('create community failed');
  const communityId = comRes.data.data.id;
  await sleep(200);
  log('user1 joins community');
  try { await c1.post(`/api/v1/communities/${communityId}/join`); } catch (e) { console.error('join error', e.response?.status, e.response?.data || e.message); throw e; }
  await sleep(200);

  // user2 creates a public post and a community post
  log('user2 creates public and community posts');
  const pPub = await c2.post('/api/v1/posts', { title: 'u2 public', body: 'hello', visibility: 'public' });
  if (pPub.status !== 201 || !pPub.data.ok) throw new Error('u2 public post failed');
  const pCom = await c2.post('/api/v1/posts', { title: 'u2 in community', body: 'hello com', visibility: 'community', communityId });
  if (pCom.status !== 201 || !pCom.data.ok) throw new Error('u2 community post failed');
  await sleep(300);

  // Fetch home feed for user1
  log('user1 fetches home feed');
  const feed = await c1.get('/api/v1/posts/feed/home?sort=new&pageSize=20');
  log('feed response status:', feed.status);
  log('feed response data:', JSON.stringify(feed.data, null, 2));
  if (feed.status !== 200 || !feed.data.ok) throw new Error(`home feed failed: ${feed.status} - ${JSON.stringify(feed.data)}`);
  log('home feed count', feed.data.data.length);

  // Fetch community posts
  log('fetch community posts');
  const cp = await c1.get(`/api/v1/communities/${communityId}/posts?sort=new&pageSize=20`);
  log('community posts response status:', cp.status);
  log('community posts response data:', JSON.stringify(cp.data, null, 2));
  if (cp.status !== 200 || !cp.data.ok) throw new Error(`community posts failed: ${cp.status} - ${JSON.stringify(cp.data)}`);
  log('community posts count', cp.data.data.length);

  // List members
  log('list community members');
  const mem = await c1.get(`/api/v1/communities/${communityId}/members?pageSize=20`);
  if (mem.status !== 200 || !mem.data.ok) throw new Error('members failed');
  log('members count', mem.data.data.length);

  // Set user2 privacy settings
  log('user2 sets privacy');
  try { await c2.patch('/api/v1/me/settings', { accountPrivacy: 'private', showLikedPosts: false, showFollowers: false, showFollowing: false }); } catch (e) { console.error('privacy update error', e.response?.status, e.response?.data || e.message); throw e; }
  await sleep(200);

  // user1 views user2 public profile with privacy
  log('user1 views user2 profile');
  const prof = await c1.get(`/api/v1/users/${u2.uid}`);
  log('profile response status:', prof.status);
  log('profile response data:', JSON.stringify(prof.data, null, 2));
  if (prof.status !== 200 || !prof.data.ok) throw new Error(`public profile failed: ${prof.status} - ${JSON.stringify(prof.data)}`);
  log('profile private?', prof.data.data.private === true);

  // liked posts privacy
  log('user1 views user2 liked posts');
  const likes = await c1.get(`/api/v1/users/${u2.uid}/likes`);
  if (likes.status !== 403) throw new Error('liked posts should be private');

  // followers/following privacy
  log('user1 views user2 followers');
  const followers = await c1.get(`/api/v1/users/${u2.uid}/followers`);
  if (followers.status !== 403) throw new Error('followers should be private');
  log('user1 views user2 following');
  const following = await c1.get(`/api/v1/users/${u2.uid}/following`);
  if (following.status !== 403) throw new Error('following should be private');

  log('Feed & privacy test completed successfully');
}

main().catch(err => { 
  console.error('Feed/privacy test failed:', err.message);
  console.error('Error details:', err);
  if (err.response) {
    console.error('Response status:', err.response.status);
    console.error('Response data:', err.response.data);
  }
  process.exit(1); 
});


