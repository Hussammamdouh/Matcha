'use strict';

// Compatibility wrapper so imports like '../../lib/firebase' from files under `src/` work.
// It re-exports everything from `src/lib/firebase` and also exposes `db` and `storage`
// proxies for legacy code that expects instances.

const firebaseLib = require('../src/lib/firebase');

// Lazy proxies that delegate to the initialized Firebase services at call time
const db = new Proxy({}, {
  get: function getFirestoreProperty(_target, property) {
    return firebaseLib.getFirestore()[property];
  }
});

const storage = new Proxy({}, {
  get: function getStorageProperty(_target, property) {
    return firebaseLib.getStorage()[property];
  }
});

module.exports = {
  ...firebaseLib,
  db,
  storage,
};



