const axios = require('axios');
const { config } = require('../../config');

/**
 * Login with email & password via Firebase Identity Toolkit REST API
 * Returns ID token and refresh token
 * @param {string} email
 * @param {string} password
 */
async function loginWithEmailPassword(email, password) {
  if (!config.firebase.webApiKey) {
    throw new Error('FIREBASE_WEB_API_KEY is required for email/password login');
  }

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.firebase.webApiKey}`;
  const payload = { email, password, returnSecureToken: true };

  try {
    const { data } = await axios.post(url, payload, { timeout: 10000 });
    return {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
      localId: data.localId,
      email: data.email,
    };
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    // Normalize common Firebase errors
    if (message === 'EMAIL_NOT_FOUND' || message === 'INVALID_PASSWORD') {
      const err = new Error('Invalid email or password');
      err.statusCode = 400;
      throw err;
    }
    if (message === 'USER_DISABLED') {
      const err = new Error('User account disabled');
      err.statusCode = 403;
      throw err;
    }
    const err = new Error(`Login failed: ${message}`);
    err.statusCode = 400;
    throw err;
  }
}

module.exports = {
  loginWithEmailPassword,
};


