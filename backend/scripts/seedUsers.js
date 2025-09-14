const { initializeFirebase, getAuth, getFirestore } = require('../src/lib/firebase');

(async function seedUsers() {
  try {
    // Ensure Firebase Admin is initialized for standalone script
    initializeFirebase();
    const auth = getAuth();
    const db = getFirestore();

    const users = [
      { email: 'it@example.com', password: 'Password!123', nickname: 'it_user', role: 'it' },
      { email: 'admin@example.com', password: 'Password!123', nickname: 'admin_user', role: 'admin' },
      { email: 'user1@example.com', password: 'Password!123', nickname: 'user_one', role: 'user' },
      { email: 'user2@example.com', password: 'Password!123', nickname: 'user_two', role: 'user' },
      { email: 'user3@example.com', password: 'Password!123', nickname: 'user_three', role: 'user' },
    ];

    for (const u of users) {
      // Create or get existing user
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(u.email);
      } catch (_) {}
      if (!userRecord) {
        userRecord = await auth.createUser({ email: u.email, password: u.password, emailVerified: true, displayName: u.nickname });
      }

      // Set custom claims
      const claims = { role: u.role };
      if (u.role === 'it') claims.it = true;
      await auth.setCustomUserClaims(userRecord.uid, claims);

      // Seed profile document
      const userDoc = db.collection('users').doc(userRecord.uid);
      await userDoc.set({
        uid: userRecord.uid,
        email: u.email,
        nickname: u.nickname,
        role: u.role,
        status: 'active',
        isMfaEnabled: false,
        genderVerificationStatus: 'approved',
        createdAt: new Date(),
        updatedAt: new Date(),
      }, { merge: true });

      console.log(`Seeded user: ${u.email} (${u.role})`);
    }

    console.log('Seeding complete.');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
})();
