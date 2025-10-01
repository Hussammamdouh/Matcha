const { aggregateCommunityVotesForUser, searchMenReviews, getUserVotingHistory } = require('./service');
const { db } = require('../../../lib/firebase');
const { createRequestLogger } = require('../../lib/logger');


async function getAggregatedReviews(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const userId = req.user.uid;
    const { limit, beforeTs, excludeVoted } = req.query;

    const parsedLimit = Math.max(1, Math.min(parseInt(limit || '25', 10) || 25, 100));
    const options = {
      limit: parsedLimit,
      beforeTs: beforeTs ? new Date(beforeTs) : null,
      excludeVoted: typeof excludeVoted === 'string'
        ? !(['false', '0', 'no'].includes(excludeVoted.toLowerCase()))
        : true,
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

// Search men reviews by name or phone number
async function searchMenReviewsController(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const userId = req.user.uid;
    const { q: query, limit, cursor } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({ 
        ok: false, 
        error: { code: 'MISSING_QUERY', message: 'Search query is required' } 
      });
    }

    const result = await searchMenReviews(query.trim(), userId, {
      limit: parseInt(limit) || 20,
      cursor
    });

    logger.info('Men reviews search completed', {
      userId,
      query,
      resultCount: result.items.length,
      total: result.pagination.total
    });

    return res.json({ 
      ok: true, 
      data: result.items,
      meta: {
        query,
        pagination: result.pagination
      }
    });
  } catch (error) {
    logger.error('searchMenReviews failed', { error: error.message });
    return res.status(500).json({ 
      ok: false, 
      error: { code: 'SEARCH_FAILED', message: 'Failed to search men reviews' } 
    });
  }
}

// Get user's voting history (men they've voted on)
async function getUserVotingHistoryController(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const userId = req.user.uid;
    const { limit, cursor } = req.query;

    const result = await getUserVotingHistory(userId, {
      limit: parseInt(limit) || 20,
      cursor
    });

    logger.info('User voting history retrieved', {
      userId,
      resultCount: result.items.length,
      total: result.pagination.total
    });

    return res.json({ 
      ok: true, 
      data: result.items,
      meta: {
        pagination: result.pagination
      }
    });
  } catch (error) {
    logger.error('getUserVotingHistory failed', { error: error.message });
    return res.status(500).json({ 
      ok: false, 
      error: { code: 'HISTORY_FAILED', message: 'Failed to get voting history' } 
    });
  }
}

// Create a new men review vote/comment
async function createReview(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const userId = req.user.uid;
    const { communityId, targetId, label, comment, manName, phoneNumber } = req.body;
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
      manName: manName || null, // New field for man's name
      phoneNumber: phoneNumber || null, // New field for man's phone number
      // If directUpload ran, it may have set req.body.media = [{ url, type }]
      media: Array.isArray(req.body?.media) ? req.body.media : [],
      createdAt: new Date(),
      updatedAt: new Date(),
      counts: { 
        green: label === 'green' ? 1 : 0, 
        red: label === 'red' ? 1 : 0, 
        unknown: label === 'unknown' ? 1 : 0 
      },
    };
    await ref.set(doc);
    
    // Also store the creator's vote in the votes subcollection
    await ref.collection('votes').doc(userId).set({ 
      userId, 
      label, 
      updatedAt: new Date() 
    });
    
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
    const ref = db.collection('men_reviews').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Review not found' } });
    // Fetch comments and votes
    const [commentsSnap, votesSnap] = await Promise.all([
      ref.collection('comments').orderBy('createdAt', 'asc').get(),
      ref.collection('votes').get(),
    ]);
    const comments = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const votes = votesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ ok: true, data: { id: snap.id, ...snap.data(), comments, votes } });
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
    const before = await voteRef.get();
    const beforeLabel = before.exists ? before.data()?.label : null;
    await voteRef.set({ userId, label, updatedAt: new Date() }, { merge: true });

    // Maintain aggregate counts on the review doc
    const inc = (field, n) => db.FieldValue ? db.FieldValue.increment(n) : require('firebase-admin').firestore.FieldValue.increment(n);
    const updates = { updatedAt: new Date() };
    if (beforeLabel && beforeLabel !== label) {
      updates[`counts.${beforeLabel}`] = inc(`counts.${beforeLabel}`, -1);
    }
    updates[`counts.${label}`] = inc(`counts.${label}`, 1);
    await ref.set(updates, { merge: true });

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

// Update review (author only)
async function updateReview(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const userId = req.user.uid;
    const { id } = req.params;
    const { comment, label } = req.body;
    const ref = db.collection('men_reviews').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Review not found' } });
    const data = snap.data();
    if (data.voterId !== userId) {
      return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Only the author can edit this review' } });
    }
    const updates = { updatedAt: new Date() };
    if (typeof comment === 'string') updates.comment = comment;
    if (Array.isArray(req.body?.media)) updates.media = req.body.media;
    if (label && ['green', 'red', 'unknown'].includes(label)) updates.label = label;
    await ref.set(updates, { merge: true });
    const after = await ref.get();
    return res.json({ ok: true, data: { id, ...after.data() } });
  } catch (error) {
    logger.error('updateReview failed', { error: error.message });
    return res.status(500).json({ ok: false, error: { code: 'REVIEW_UPDATE_FAILED', message: 'Failed to update review' } });
  }
}

// Delete review (author, moderator, or community owner)
async function deleteReview(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const userId = req.user.uid;
    const { id } = req.params;
    const ref = db.collection('men_reviews').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Review not found' } });
    const review = snap.data();

    // Permission: author OR community owner/mods
    let canDelete = review.voterId === userId;
    if (!canDelete && review.communityId) {
      try {
        const comm = await db.collection('communities').doc(review.communityId).get();
        if (comm.exists) {
          const c = comm.data();
          const mods = Array.isArray(c.modIds) ? c.modIds : [];
          if (c.ownerId === userId || mods.includes(userId)) canDelete = true;
        }
      } catch (_) {}
    }
    if (!canDelete) {
      return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions to delete review' } });
    }

    await ref.delete();
    return res.json({ ok: true, data: { id } });
  } catch (error) {
    logger.error('deleteReview failed', { error: error.message });
    return res.status(500).json({ ok: false, error: { code: 'REVIEW_DELETE_FAILED', message: 'Failed to delete review' } });
  }
}

// List reviews in a community (post-like)
async function listCommunityReviews(req, res) {
  const logger = createRequestLogger(req.id);
  try {
    const { communityId } = req.params;
    const { pageSize = 20, cursor = null } = req.query;
    const snap = await db
      .collection('men_reviews')
      .where('communityId', '==', communityId)
      .limit(200)
      .get();
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // For each review, fetch the latest vote counts and votes
    const enrichedItems = [];
    for (const item of items) {
      try {
        const [commentsSnap, votesSnap] = await Promise.all([
          db.collection('men_reviews').doc(item.id).collection('comments').orderBy('createdAt', 'asc').get(),
          db.collection('men_reviews').doc(item.id).collection('votes').get(),
        ]);
        const comments = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const votes = votesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Calculate actual vote counts from the votes subcollection
        const actualCounts = { red: 0, green: 0, unknown: 0 };
        votes.forEach(vote => {
          if (vote.label && actualCounts.hasOwnProperty(vote.label)) {
            actualCounts[vote.label]++;
          }
        });
        
        enrichedItems.push({
          ...item,
          counts: actualCounts,
          comments,
          votes,
        });
      } catch (error) {
        logger.warn(`Failed to fetch votes/comments for review ${item.id}`, { error: error.message });
        // Fallback to original item with default counts
        enrichedItems.push({
          ...item,
          counts: item.counts || { red: 0, green: 0, unknown: 0 },
          comments: [],
          votes: [],
        });
      }
    }
    
    // Sort by createdAt desc
    enrichedItems.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
    let start = 0;
    if (cursor) {
      const idx = enrichedItems.findIndex(i => i.id === cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const page = enrichedItems.slice(start, start + parseInt(pageSize));
    const hasMore = start + parseInt(pageSize) < enrichedItems.length;
    const nextCursor = hasMore ? page[page.length - 1].id : null;
    return res.json({ ok: true, data: page, meta: { hasMore, nextCursor } });
  } catch (error) {
    logger.error('listCommunityReviews failed', { error: error.message });
    return res.status(500).json({ ok: false, error: { code: 'REVIEW_LIST_FAILED', message: 'Failed to list reviews' } });
  }
}

module.exports = {
  getAggregatedReviews,
  searchMenReviewsController,
  getUserVotingHistoryController,
  createReview,
  getReview,
  voteOnReview,
  listReviewComments,
  addReviewComment,
  listCommunityReviews,
  updateReview,
  deleteReview,
};


