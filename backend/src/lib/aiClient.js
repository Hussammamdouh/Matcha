const axios = require('axios');
const { createModuleLogger } = require('./logger');
const logger = createModuleLogger('aiClient');

/**
 * Call external AI service to classify gender from an image URL.
 * Expects AI_SERVICE_URL env, endpoint POST /infer { imageUrl }
 * Returns { gender: 'female'|'male'|'unknown', confidence: number, decision: 'approved'|'pending'|'rejected' }
 */
async function inferGenderFromImage(imageUrl) {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) {
    throw new Error('AI_SERVICE_URL is not configured');
  }
  try {
    const res = await axios.post(`${baseUrl}/infer`, { imageUrl }, { timeout: 10000 });
    const { gender, confidence, decision } = res.data || {};
    if (!gender || typeof confidence !== 'number' || !decision) {
      throw new Error('Invalid AI response');
    }
    return { gender, confidence, decision };
  } catch (error) {
    logger.error('AI inference failed', { error: error.message });
    throw error;
  }
}

module.exports = {
  inferGenderFromImage,
};
