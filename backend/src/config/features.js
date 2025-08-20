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

  // Voice posts (audio content)
  voicePosts: process.env.ENABLE_VOICE_POSTS === 'true' || false,

  // Search provider integration
  searchProvider: process.env.SEARCH_PROVIDER || 'none', // 'none' | 'algolia' | 'meili'

  // Shadowban system for abusive users
  shadowban: process.env.ENABLE_SHADOWBAN === 'true' || false,

  // Chat system features
  chatAudio: process.env.ENABLE_CHAT_AUDIO === 'true' || true,
  chatRealtimeWs: process.env.ENABLE_CHAT_REALTIME_WS === 'true' || true,
  chatTyping: process.env.ENABLE_CHAT_TYPING === 'true' || true,
  chatPresence: process.env.ENABLE_CHAT_PRESENCE === 'true' || true,
  chatModeration: process.env.ENABLE_CHAT_MODERATION === 'true' || true,
  chatPush: process.env.ENABLE_CHAT_PUSH === 'true' || false,
};

module.exports = features;
