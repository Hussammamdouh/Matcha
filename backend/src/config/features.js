/**
 * Feature flags configuration for Matcha backend
 * This file serves as the single source of truth for feature toggles
 * Features can be overridden via environment variables
 */

const features = {
  // KYC (Know Your Customer) verification system
  kyc: process.env.ENABLE_KYC === 'true' || false,
  
  // Phone authentication (OTP + SMS MFA)
  phoneAuth: process.env.ENABLE_PHONE_AUTH === 'true' || false,
  
  // reCAPTCHA Enterprise integration
  recaptcha: process.env.ENABLE_RECAPTCHA === 'true' || false,
};

module.exports = features;

