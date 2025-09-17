/*
 End-to-end local test:
 1) Login with provided credentials
 2) Upload PNG from backend/postman/Screenshot (314).png via proxy
 3) Create a post with returned media URL
*/

const fs = require('fs');
const path = require('path');

async function main() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
  const email = process.env.TEST_EMAIL || 'user1@example.com';
  const password = process.env.TEST_PASSWORD || 'Password!123';
  const pngPath = path.resolve(__dirname, '../postman/Screenshot (314).png');

  if (!fs.existsSync(pngPath)) {
    console.error('PNG not found at', pngPath);
    process.exit(1);
  }

  // 1) Login
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginJson = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Login failed:', loginJson);
    process.exit(1);
  }
  const token = loginJson.data?.idToken || loginJson.idToken;
  if (!token) {
    console.error('No idToken in login response:', loginJson);
    process.exit(1);
  }
  console.log('Login OK');

  // 2) Proxy upload
  const fileBuffer = fs.readFileSync(pngPath);
  const formData = new FormData();
  const publicId = `posts/test-post/media/${Date.now()}_screenshot_314.png`;
  formData.append('file', new Blob([fileBuffer]), 'screenshot.png');
  formData.append('public_id', publicId);
  formData.append('resource_type', 'image');

  const uploadRes = await fetch(`${baseUrl}/api/v1/storage/proxy/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const uploadJson = await uploadRes.json();
  if (!uploadRes.ok || !uploadJson.ok) {
    console.error('Upload failed:', uploadJson);
    process.exit(1);
  }
  const mediaUrl = uploadJson.data?.url;
  if (!mediaUrl) {
    console.error('No URL returned from upload:', uploadJson);
    process.exit(1);
  }
  console.log('Upload OK:', mediaUrl);

  // 3) Create a post
  const createPostRes = await fetch(`${baseUrl}/api/v1/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'Local Test Post',
      body: 'This post was created by testMediaFlow.js',
      visibility: 'public',
      media: [
        { url: mediaUrl, type: 'image' },
      ],
    }),
  });
  const postJson = await createPostRes.json();
  if (!createPostRes.ok || !postJson.ok) {
    console.error('Create post failed:', postJson);
    process.exit(1);
  }
  console.log('Post created:', postJson.data);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});


