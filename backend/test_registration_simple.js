const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BACKEND_URL = 'http://localhost:8080';
const AI_URL = 'http://localhost:8000';

// Simple test function
async function quickTest() {
  console.log('🚀 Quick Registration Test');
  console.log('============================');
  
  // Check if servers are running
  try {
    console.log('📡 Checking Backend server...');
    await axios.get(`${BACKEND_URL}/healthz`, { timeout: 3000 });
    console.log('✅ Backend server is running');
  } catch (error) {
    console.log('❌ Backend server not responding:', error.message);
    return;
  }
  
  try {
    console.log('📡 Checking AI server...');
    await axios.get(`${AI_URL}/healthz`, { timeout: 3000 });
    console.log('✅ AI server is running');
  } catch (error) {
    console.log('❌ AI server not responding:', error.message);
    return;
  }
  
  // Test registration with female image
  const imagePath = path.join(__dirname, 'postman', 'female.jpeg');
  
  if (!fs.existsSync(imagePath)) {
    console.log('❌ Test image not found:', imagePath);
    return;
  }
  
  console.log('📝 Testing registration with image upload...');
  
  const form = new FormData();
  const timestamp = Date.now();
  
  form.append('email', `quicktest_${timestamp}@example.com`);
  form.append('password', 'TestPassword123!');
  form.append('nickname', `testuser${Math.floor(Math.random() * 10000)}`);
  form.append('avatar', fs.createReadStream(imagePath));
  
  try {
    const response = await axios.post(`${BACKEND_URL}/api/v1/auth/register-email`, form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 30000,
    });
    
    console.log('✅ Registration successful!');
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
    
    const userId = response.data.data?.userId;
    if (userId) {
      console.log('🔄 Testing selfie processing...');
      
      const selfieForm = new FormData();
      selfieForm.append('userId', userId);
      selfieForm.append('image', fs.createReadStream(imagePath));
      
      try {
        const selfieResponse = await axios.post(`${BACKEND_URL}/api/v1/auth/register/selfie`, selfieForm, {
          headers: {
            ...selfieForm.getHeaders(),
          },
          timeout: 30000,
        });
        
        console.log('✅ Selfie processing successful!');
        console.log('📊 AI Response:', JSON.stringify(selfieResponse.data, null, 2));
      } catch (error) {
        console.log('❌ Selfie processing failed:', error.message);
        if (error.response) {
          console.log('📊 Error response:', JSON.stringify(error.response.data, null, 2));
        }
      }
    }
    
  } catch (error) {
    console.log('❌ Registration failed:', error.message);
    if (error.response) {
      console.log('📊 Error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('🏁 Test completed!');
}

// Run the test
if (require.main === module) {
  quickTest().catch(console.error);
}

module.exports = { quickTest };
