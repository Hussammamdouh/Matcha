#!/usr/bin/env node

/**
 * Data seeding script for Matcha backend
 * Creates demo users and test data for staging environment
 * 
 * Usage: 
 *   SEED_ALLOW=true node scripts/seed.js
 *   SEED_ALLOW=true npm run seed
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Check if seeding is allowed
if (process.env.SEED_ALLOW !== 'true') {
  console.error('❌ Seeding not allowed. Set SEED_ALLOW=true to enable.');
  process.exit(1);
}

// Initialize Firebase Admin
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('❌ GOOGLE_APPLICATION_CREDENTIALS not set');
  process.exit(1);
}

try {
  initializeApp({
    credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  if (error.code === 'app/duplicate-app') {
    console.log('✅ Firebase Admin already initialized');
  } else {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
  }
}

const auth = getAuth();
const firestore = getFirestore();

// Demo user data
const demoUsers = [
  {
    email: 'alice@demo.matcha.app',
    password: 'DemoPass123!',
    nickname: 'AliceWonder',
    displayName: 'Alice',
    bio: 'Adventure seeker and coffee enthusiast ☕',
  },
  {
    email: 'bella@demo.matcha.app',
    password: 'DemoPass123!',
    nickname: 'BellaGrace',
    displayName: 'Bella',
    bio: 'Artist by day, dreamer by night 🎨',
  },
  {
    email: 'chloe@demo.matcha.app',
    password: 'DemoPass123!',
    nickname: 'ChloeSun',
    displayName: 'Chloe',
    bio: 'Yoga instructor spreading positive vibes 🧘‍♀️',
  },
  {
    email: 'diana@demo.matcha.app',
    password: 'DemoPass123!',
    nickname: 'DianaMoon',
    displayName: 'Diana',
    bio: 'Book lover and amateur astronomer 📚✨',
  },
  {
    email: 'emma@demo.matcha.app',
    password: 'DemoPass123!',
    nickname: 'EmmaRose',
    displayName: 'Emma',
    bio: 'Plant mom and sustainability advocate 🌱',
  },
];

// Default avatar URLs (placeholder images)
const defaultAvatars = [
  'https://via.placeholder.com/200x200/FF6B6B/FFFFFF?text=A',
  'https://via.placeholder.com/200x200/4ECDC4/FFFFFF?text=B',
  'https://via.placeholder.com/200x200/45B7D1/FFFFFF?text=C',
  'https://via.placeholder.com/200x200/96CEB4/FFFFFF?text=D',
  'https://via.placeholder.com/200x200/FFEAA7/000000?text=E',
];

/**
 * Create a demo user
 * @param {Object} userData - User data
 * @param {number} index - User index for avatar selection
 * @returns {Promise<Object>} Created user
 */
async function createDemoUser(userData, index) {
  try {
    // Check if user already exists
    try {
      const existingUser = await auth.getUserByEmail(userData.email);
      console.log(`⏭️  User ${userData.email} already exists, skipping`);
      return existingUser;
    } catch (error) {
      // User doesn't exist, continue with creation
    }

    // Check if nickname is available
    const nicknameQuery = await firestore
      .collection('users')
      .where('nickname', '==', userData.nickname)
      .limit(1)
      .get();

    if (!nicknameQuery.empty) {
      console.log(`⚠️  Nickname ${userData.nickname} already taken, generating new one`);
      userData.nickname = `${userData.nickname}_${Date.now()}`;
    }

    // Create Firebase user
    const userRecord = await auth.createUser({
      email: userData.email,
      password: userData.password,
      emailVerified: true, // Auto-verify for demo
      displayName: userData.displayName,
    });

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'user',
      gv: 'approved', // Auto-approve for demo
    });

    // Create user profile in Firestore
    const userDoc = {
      uid: userRecord.uid,
      email: userData.email,
      nickname: userData.nickname,
      displayName: userData.displayName,
      bio: userData.bio,
      status: 'active',
      genderVerificationStatus: 'approved',
      kycProvider: 'demo',
      isMfaEnabled: false,
      avatarUrl: defaultAvatars[index % defaultAvatars.length],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await firestore.collection('users').doc(userRecord.uid).set(userDoc);

    // Create private user data
    const privateDoc = {
      uid: userRecord.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await firestore.collection('users_private').doc(userRecord.uid).set(privateDoc);

    // Create demo device
    const deviceData = {
      id: `demo-device-${userRecord.uid}`,
      userId: userRecord.uid,
      deviceId: `demo-${userRecord.uid}`,
      platform: 'web',
      pushToken: 'demo-push-token',
      deviceName: 'Demo Web Browser',
      appVersion: '1.0.0',
      osVersion: 'Demo OS',
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await firestore.collection('devices').doc(deviceData.id).set(deviceData);

    console.log(`✅ Created user: ${userData.email} (${userData.nickname})`);
    return userRecord;
  } catch (error) {
    console.error(`❌ Failed to create user ${userData.email}:`, error.message);
    throw error;
  }
}

/**
 * Main seeding function
 */
async function seedData() {
  console.log('🌱 Starting data seeding...');
  console.log(`📁 Project: ${process.env.FIREBASE_PROJECT_ID}`);
  console.log(`🔐 Environment: ${process.env.NODE_ENV}`);
  console.log('');

  try {
    const createdUsers = [];
    
    for (let i = 0; i < demoUsers.length; i++) {
      const userData = demoUsers[i];
      try {
        const user = await createDemoUser(userData, i);
        createdUsers.push(user);
      } catch (error) {
        console.error(`Failed to create user ${userData.email}:`, error.message);
      }
    }

    console.log('');
    console.log(`🎉 Seeding completed!`);
    console.log(`✅ Created/Updated: ${createdUsers.length} users`);
    console.log('');
    console.log('📱 Demo users created:');
    createdUsers.forEach((user, index) => {
      const userData = demoUsers[index];
      console.log(`   ${index + 1}. ${userData.email} (${userData.nickname})`);
      console.log(`      Password: ${userData.password}`);
    });
    console.log('');
    console.log('💡 You can now test the API with these demo accounts!');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedData()
    .then(() => {
      console.log('✅ Seeding script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding script failed:', error);
      process.exit(1);
    });
}

module.exports = { seedData, createDemoUser };




