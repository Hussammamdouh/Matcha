const { aggregateCommunityVotesForUser } = require('./service');
const { db } = require('../../../lib/firebase');
const { createRequestLogger } = require('../../lib/logger');


async function getAggregatedReviews(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const userId = req.user.uid;
    const { limit, beforeTs } = req.query;

    const parsedLimit = Math.max(1, Math.min(parseInt(limit || '25', 10) || 25, 100));
    const options = {
      limit: parsedLimit,
      beforeTs: beforeTs ? new Date(beforeTs) : null,
    };

    const result = await aggregateCommunityVotesForUser(userId, options);

    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    logger.error('getAggregatedReviews failed', {
      error: error.message,
    });
    return res.status(500).json({
      ok: false,
      error: {
        code: 'REVIEWS_AGGREGATE_FAILED',
        message: 'Failed to aggregate reviews',
      },
    });
  }
}

// Create a new men review vote/comment
async function createReview(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const userId = req.user.uid;
    const { communityId, targetId, label, comment } = req.body;
    if (!communityId || !label) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'communityId and label are required' } });
    }
    const valid = ['red', 'green', 'unknown'];
    if (!valid.includes(label)) {
      return res.status(400).json({ ok: false, error: { code: 'INVALID_LABEL', message: 'label must be red|green|unknown' } });
    }
    const ref = db.collection('men_reviews').doc();
    const doc = {
      id: ref.id,
      communityId,
      voterId: userId,
      targetId: targetId || null,
      label,
      comment: comment || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await ref.set(doc);
    return res.status(201).json({ ok: true, data: doc });
  } catch (error) {
    logger.error('createReview failed', { error: error.message });
    return res.status(500).json({ ok: false, error: { code: 'REVIEW_CREATE_FAILED', message: 'Failed to create review' } });
  }
}

async function getReview(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const { id } = req.params;
    const snap = await db.collection('men_reviews').doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Review not found' } });
    return res.json({ ok: true, data: { id: snap.id, ...snap.data() } });
  } catch (error) {
    logger.error('getReview failed', { error: error.message });
    return res.status(500).json({ ok: false, error: { code: 'REVIEW_GET_FAILED', message: 'Failed to get review' } });
  }
}

async function voteOnReview(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const userId = req.user.uid;
    const { id } = req.params;
    const { label } = req.body;
    const valid = ['red', 'green', 'unknown'];
    if (!valid.includes(label)) {
      return res.status(400).json({ ok: false, error: { code: 'INVALID_LABEL', message: 'label must be red|green|unknown' } });
    }
    const ref = db.collection('men_reviews').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Review not found' } });
    // Store each user's label in a subcollection for stats and idempotency
    const voteRef = ref.collection('votes').doc(userId);
    await voteRef.set({ userId, label, updatedAt: new Date() }, { merge: true });
    return res.json({ ok: true, data: { reviewId: id, label } });
  } catch (error) {
    logger.error('voteOnReview failed', { error: error.message });
    return res.status(500).json({ ok: false, error: { code: 'REVIEW_VOTE_FAILED', message: 'Failed to vote on review' } });
  }
}

async function listReviewComments(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const { id } = req.params;
    const snap = await db.collection('men_reviews').doc(id).collection('comments').orderBy('createdAt', 'asc').get();
    const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ ok: true, data: comments });
  } catch (error) {
    logger.error('listReviewComments failed', { error: error.message });
    return res.status(500).json({ ok: false, error: { code: 'REVIEW_COMMENTS_FAILED', message: 'Failed to fetch comments' } });
  }
}

async function addReviewComment(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const userId = req.user.uid;
    const { id } = req.params;
    const { body, parentCommentId } = req.body;
    if (!body) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'body is required' } });
    }
    const ref = db.collection('men_reviews').doc(id).collection('comments').doc();
    const doc = { id: ref.id, body, parentCommentId: parentCommentId || null, userId, createdAt: new Date(), updatedAt: new Date() };
    await ref.set(doc);
    return res.status(201).json({ ok: true, data: doc });
  } catch (error) {
    logger.error('addReviewComment failed', { error: error.message });
    return res.status(500).json({ ok: false, error: { code: 'REVIEW_COMMENT_FAILED', message: 'Failed to add comment' } });
  }
}

module.exports = {
  getAggregatedReviews,
  createReview,
  getReview,
  voteOnReview,
  listReviewComments,
  addReviewComment,
};


