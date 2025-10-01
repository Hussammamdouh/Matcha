const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BACKEND_URL = 'http://localhost:8080';
const AI_URL = 'http://localhost:8000';
const POSTMAN_IMAGES_PATH = path.join(__dirname, 'postman');

// Test images available in postman folder
const TEST_IMAGES = [
  'female.jpeg',
  'female100%.jpeg', 
  'male.jpeg'
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`🧪 TEST: ${testName}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logStep(step) {
  log(`\n📋 STEP: ${step}`, 'yellow');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Test helper functions
async function checkServerHealth(url, serverName) {
  try {
    const response = await axios.get(`${url}/healthz`, { timeout: 5000 });
    logSuccess(`${serverName} server is healthy: ${response.data.ok}`);
    return true;
  } catch (error) {
    logError(`${serverName} server is not responding: ${error.message}`);
    return false;
  }
}

async function registerUserWithImage(imagePath, testName) {
  logStep(`Registering user with image: ${path.basename(imagePath)}`);
  
  const form = new FormData();
  
  // Add user data
  const timestamp = Date.now();
  form.append('email', `test_${timestamp}@example.com`);
  form.append('password', 'TestPassword123!');
  form.append('nickname', `testuser${Math.floor(Math.random() * 10000)}`);
  
  // Add image file
  if (fs.existsSync(imagePath)) {
    form.append('avatar', fs.createReadStream(imagePath));
    logInfo(`Uploading image: ${imagePath}`);
  } else {
    logError(`Image file not found: ${imagePath}`);
    return null;
  }
  
  try {
    const response = await axios.post(`${BACKEND_URL}/api/v1/auth/register-email`, form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 30000,
    });
    
    logSuccess(`Registration successful for ${testName}`);
    logInfo(`Response: ${JSON.stringify(response.data, null, 2)}`);
    return response.data;
  } catch (error) {
    logError(`Registration failed for ${testName}: ${error.message}`);
    if (error.response) {
      logError(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return null;
  }
}

async function testSelfieProcessing(userId, imagePath, testName) {
  logStep(`Processing selfie for user: ${userId}`);
  
  const form = new FormData();
  form.append('userId', userId);
  
  if (fs.existsSync(imagePath)) {
    form.append('image', fs.createReadStream(imagePath));
    logInfo(`Uploading selfie image: ${imagePath}`);
  } else {
    logError(`Selfie image file not found: ${imagePath}`);
    return null;
  }
  
  try {
    const response = await axios.post(`${BACKEND_URL}/api/v1/auth/register/selfie`, form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 30000,
    });
    
    logSuccess(`Selfie processing successful for ${testName}`);
    logInfo(`Response: ${JSON.stringify(response.data, null, 2)}`);
    return response.data;
  } catch (error) {
    logError(`Selfie processing failed for ${testName}: ${error.message}`);
    if (error.response) {
      logError(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return null;
  }
}

async function testDirectAICall(imagePath, testName) {
  logStep(`Testing direct AI inference for: ${path.basename(imagePath)}`);
  
  // First upload image to get URL
  const form = new FormData();
  if (fs.existsSync(imagePath)) {
    form.append('file', fs.createReadStream(imagePath));
  } else {
    logError(`Image file not found: ${imagePath}`);
    return null;
  }
  
  try {
    const response = await axios.post(`${AI_URL}/infer-file`, form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 30000,
    });
    
    logSuccess(`Direct AI inference successful for ${testName}`);
    logInfo(`AI Response: ${JSON.stringify(response.data, null, 2)}`);
    return response.data;
  } catch (error) {
    logError(`Direct AI inference failed for ${testName}: ${error.message}`);
    if (error.response) {
      logError(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return null;
  }
}

async function runCompleteRegistrationTest() {
  log('🚀 STARTING COMPLETE REGISTRATION FLOW TEST', 'bright');
  log(`Backend URL: ${BACKEND_URL}`, 'blue');
  log(`AI URL: ${AI_URL}`, 'blue');
  
  // Check server health
  logTest('Server Health Check');
  const backendHealthy = await checkServerHealth(BACKEND_URL, 'Backend');
  const aiHealthy = await checkServerHealth(AI_URL, 'AI');
  
  if (!backendHealthy || !aiHealthy) {
    logError('One or more servers are not healthy. Aborting tests.');
    return;
  }
  
  // Test each image type
  for (const imageName of TEST_IMAGES) {
    const imagePath = path.join(POSTMAN_IMAGES_PATH, imageName);
    
    if (!fs.existsSync(imagePath)) {
      logError(`Test image not found: ${imagePath}`);
      continue;
    }
    
    const testName = imageName.replace('.jpeg', '').toUpperCase();
    
    // Test 1: Direct AI inference
    logTest(`Direct AI Inference - ${testName}`);
    await testDirectAICall(imagePath, testName);
    
    // Test 2: Complete registration with image upload
    logTest(`Complete Registration Flow - ${testName}`);
    const registrationResult = await registerUserWithImage(imagePath, testName);
    
    if (registrationResult && registrationResult.data && registrationResult.data.userId) {
      const userId = registrationResult.data.userId;
      
      // Test 3: Selfie processing (gender verification)
      logTest(`Selfie Processing - ${testName}`);
      await testSelfieProcessing(userId, imagePath, testName);
      
      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      logError(`Registration failed for ${testName}, skipping selfie processing`);
    }
  }
  
  // Test edge cases
  logTest('Edge Case Testing');
  
  // Test with invalid image
  logStep('Testing with non-existent image');
  const invalidImagePath = path.join(POSTMAN_IMAGES_PATH, 'nonexistent.jpeg');
  await registerUserWithImage(invalidImagePath, 'INVALID_IMAGE');
  
  // Test with duplicate email
  logStep('Testing duplicate email registration');
  const duplicateForm = new FormData();
  const timestamp = Date.now();
  duplicateForm.append('email', 'duplicate@example.com');
  duplicateForm.append('password', 'TestPassword123!');
  duplicateForm.append('nickname', `duplicate_${timestamp}`);
  
  try {
    await axios.post(`${BACKEND_URL}/api/v1/auth/register-email`, duplicateForm, {
      headers: {
        ...duplicateForm.getHeaders(),
      },
      timeout: 10000,
    });
    
    // Try again with same email
    await axios.post(`${BACKEND_URL}/api/v1/auth/register-email`, duplicateForm, {
      headers: {
        ...duplicateForm.getHeaders(),
      },
      timeout: 10000,
    });
  } catch (error) {
    if (error.response && error.response.status === 409) {
      logSuccess('Duplicate email correctly rejected');
    } else {
      logError(`Unexpected error in duplicate test: ${error.message}`);
    }
  }
  
  log('\n🏁 REGISTRATION FLOW TEST COMPLETED', 'bright');
  log('Check the logs above for detailed results.', 'blue');
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

process.on('uncaughtException', (error) => {
  logError(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Run the test
if (require.main === module) {
  runCompleteRegistrationTest().catch(error => {
    logError(`Test execution failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runCompleteRegistrationTest,
  registerUserWithImage,
  testSelfieProcessing,
  testDirectAICall
};
