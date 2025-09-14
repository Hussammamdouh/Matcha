const { features } = require('../config');

/**
 * Verify reCAPTCHA token (no-op when feature is disabled)
 * @param {string} token - reCAPTCHA token
 * @param {string} ip - Client IP address
 * @returns {Object} Verification result
 */
async function verifyRecaptchaToken(token, ip) {
  if (!features.recaptcha) {
    // Feature disabled - return success
    return {
      ok: true,
      score: 1.0,
      action: 'verify',
      success: true,
    };
  }

  // TODO: Implement real reCAPTCHA verification when feature is enabled
  // This would typically involve:
  // 1. Sending token to Google reCAPTCHA Enterprise API
  // 2. Validating response and score
  // 3. Returning verification result

  throw new Error('reCAPTCHA verification not implemented');
}

module.exports = {
  verifyRecaptchaToken,
};





