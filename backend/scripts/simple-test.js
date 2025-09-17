const axios = require('axios').default;
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';

async function test() {
  try {
    console.log('Testing basic auth...');
    const res = await axios.post(`${BASE_URL}/api/v1/auth/login`, { 
      email: 'user1@example.com', 
      password: 'Password!123' 
    });
    console.log('Login response:', res.status, res.data);
    
    const token = res.data.data.idToken;
    const client = axios.create({ 
      baseURL: BASE_URL, 
      headers: { Authorization: `Bearer ${token}` } 
    });
    
    const meRes = await client.get('/api/v1/me');
    console.log('Me response:', meRes.status, meRes.data);
    
    console.log('Basic test passed!');
  } catch (error) {
    console.error('Test failed:', error.response?.status, error.response?.data || error.message);
  }
}

test();
