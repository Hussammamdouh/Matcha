const sanitizeHtml = require('sanitize-html');

/**
 * Chat-specific HTML sanitization configuration
 * Allows basic markdown-like formatting while ensuring security
 */
const chatSanitizeConfig = {
  allowedTags: [], // No HTML tags allowed
  allowedAttributes: {},
  allowedSchemes: [],
  textFilter: (text) => {
    // Convert markdown-like syntax to safe text
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // **bold** -> plain text
      .replace(/\*(.*?)\*/g, '$1')     // *italic* -> plain text
      .replace(/_(.*?)_/g, '$1')       // _underline_ -> plain text
      .replace(/`(.*?)`/g, '$1')       // `code` -> plain text
      .replace(/\n/g, ' ')             // Newlines to spaces
      .trim();
  },
  // Maximum length for chat messages
  maxLength: 5000,
};

/**
 * Sanitize chat text content
 * @param {string} text - Raw text input
 * @returns {string} Sanitized text
 */
function sanitizeChatText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Check length limit
  if (text.length > chatSanitizeConfig.maxLength) {
    text = text.substring(0, chatSanitizeConfig.maxLength);
  }

  // Apply sanitization
  const sanitized = sanitizeHtml(text, chatSanitizeConfig);
  
  // Apply text filter for markdown-like syntax
  return chatSanitizeConfig.textFilter(sanitized);
}

/**
 * Detect and extract links from text (for future link annotation)
 * @param {string} text - Sanitized text
 * @returns {Array} Array of detected URLs
 */
function detectLinks(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex) || [];
  
  return matches.map(url => ({
    url,
    safe: true, // All URLs are considered safe after sanitization
  }));
}

/**
 * Build message preview from text content
 * @param {string} text - Message text
 * @param {number} maxLength - Maximum preview length (default: 100)
 * @returns {string} Truncated preview
 */
function buildMessagePreview(text, maxLength = 100) {
  if (!text) return '';
  
  const sanitized = sanitizeChatText(text);
  if (sanitized.length <= maxLength) {
    return sanitized;
  }
  
  return sanitized.substring(0, maxLength - 3) + '...';
}

module.exports = {
  sanitizeChatText,
  detectLinks,
  buildMessagePreview,
  chatSanitizeConfig,
};
