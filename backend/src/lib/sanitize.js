const sanitizeHtml = require('sanitize-html');

/**
 * Sanitization configuration for user-generated content
 * Strict whitelist approach to prevent XSS and unwanted HTML
 */
const sanitizeConfig = {
  allowedTags: [
    // Basic text formatting
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    // Headings (limited to prevent abuse)
    'h1',
    'h2',
    'h3',
    // Lists
    'ul',
    'ol',
    'li',
    // Links (with protocol validation)
    'a',
    // Code blocks
    'code',
    'pre',
    // Blockquotes
    'blockquote',
  ],

  allowedAttributes: {
    // Link attributes
    a: ['href', 'title', 'target'],
    // Code attributes
    code: ['class'],
    pre: ['class'],
  },

  // Allow only specific protocols for links
  allowedSchemes: ['http', 'https', 'mailto'],

  // Transform functions
  transformTags: {
    // Ensure external links open in new tab
    a: (tagName, attribs) => {
      if (attribs.href && attribs.href.startsWith('http')) {
        attribs.target = '_blank';
        attribs.rel = 'noopener noreferrer';
      }
      return { tagName, attribs };
    },
  },

  // Remove empty tags
  removeEmptyTags: true,

  // Text processing
  textFilter: text => {
    // Convert markdown-style formatting to HTML
    return (
      text
        // Bold: **text** or __text__
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        // Italic: *text* or _text_
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        // Strikethrough: ~~text~~
        .replace(/~~(.*?)~~/g, '<s>$1</s>')
        // Code: `text`
        .replace(/`(.*?)`/g, '<code>$1</code>')
        // Line breaks: \n\n for paragraphs
        .replace(/\n\n/g, '</p><p>')
    );
  },
};

/**
 * Sanitize HTML content with strict whitelist
 * @param {string} html - Raw HTML content to sanitize
 * @param {Object} options - Additional sanitization options
 * @returns {string} Sanitized HTML
 */
function sanitizeHtmlContent(html, options = {}) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const config = { ...sanitizeConfig, ...options };

  try {
    return sanitizeHtml(html, config);
  } catch (error) {
    console.error('HTML sanitization failed:', error);
    // Return empty string on sanitization failure
    return '';
  }
}

/**
 * Sanitize plain text content (no HTML)
 * @param {string} text - Raw text content
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/&/g, '&amp;') // Escape ampersands
    .replace(/"/g, '&quot;') // Escape quotes
    .replace(/'/g, '&#39;'); // Escape apostrophes
}

/**
 * Validate content length limits
 * @param {string} content - Content to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {boolean} True if content is within limits
 */
function validateContentLength(content, maxLength) {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Remove HTML tags for accurate character count
  const plainText = content.replace(/<[^>]*>/g, '');
  return plainText.length <= maxLength;
}

module.exports = {
  sanitizeHtml: sanitizeHtmlContent,
  sanitizeText,
  validateContentLength,
};
