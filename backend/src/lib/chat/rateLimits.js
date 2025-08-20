const rateLimit = require('express-rate-limit');

/**
 * Chat-specific rate limit configurations
 * These limits help prevent abuse while maintaining usability
 */

// Send message rate limits
const sendMessageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 messages per minute
  message: {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many messages sent. Please wait before sending more.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user
    return req.user?.uid || req.ip;
  },
});

const sendMessageDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 1500, // 1500 messages per day
  message: {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Daily message limit reached. Please try again tomorrow.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user
    return req.user?.uid || req.ip;
  },
});

// Create conversation rate limits
const createConversationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 conversations per minute
  message: {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many conversations created. Please wait before creating more.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user
    return req.user?.uid || req.ip;
  },
});

const createConversationDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 100, // 100 conversations per day
  message: {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Daily conversation creation limit reached. Please try again tomorrow.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user
    return req.user?.uid || req.ip;
  },
});

// Typing and presence rate limits
const typingPresenceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 typing/presence events per minute
  message: {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many typing/presence events. Please wait before sending more.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user
    return req.user?.uid || req.ip;
  },
});

// Report rate limits
const reportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 reports per minute
  message: {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many reports submitted. Please wait before submitting more.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user
    return req.user?.uid || req.ip;
  },
});

// Block/unblock rate limits
const blockLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 block/unblock actions per minute
  message: {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many block/unblock actions. Please wait before performing more.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user
    return req.user?.uid || req.ip;
  },
});

// Storage signing rate limits
const storageSignLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 storage signing requests per minute
  message: {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many storage signing requests. Please wait before requesting more.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user
    return req.user?.uid || req.ip;
  },
});

// Combined rate limiters for different endpoints
const chatRateLimiters = {
  // Message sending (apply both minute and daily limits)
  sendMessage: [sendMessageLimiter, sendMessageDailyLimiter],
  
  // Conversation creation (apply both minute and daily limits)
  createConversation: [createConversationLimiter, createConversationDailyLimiter],
  
  // Typing and presence
  typingPresence: [typingPresenceLimiter],
  
  // Reporting
  report: [reportLimiter],
  
  // Blocking
  block: [blockLimiter],
  
  // Storage signing
  storageSign: [storageSignLimiter],
};

module.exports = {
  chatRateLimiters,
  sendMessageLimiter,
  sendMessageDailyLimiter,
  createConversationLimiter,
  createConversationDailyLimiter,
  typingPresenceLimiter,
  reportLimiter,
  blockLimiter,
  storageSignLimiter,
};
