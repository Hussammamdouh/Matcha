const express = require('express');
const { authenticateToken } = require('../../middlewares/auth');
const { generalRateLimiter } = require('../../middlewares/rateLimit');
const { getAggregatedReviews, createReview, getReview, voteOnReview, listReviewComments, addReviewComment } = require('./controller');
const { getAggregatedReviewsValidation } = require('./validators');
const validate = require('../../middlewares/validation').validateQuery;


const router = express.Router();

// GET /api/v1/reviews/aggregate
router.get(
  '/aggregate',
  authenticateToken,
  generalRateLimiter,
  validate(getAggregatedReviewsValidation),
  getAggregatedReviews
);

// POST /api/v1/reviews
router.post('/', authenticateToken, generalRateLimiter, createReview);

// GET /api/v1/reviews/:id
router.get('/:id', authenticateToken, generalRateLimiter, getReview);

// POST /api/v1/reviews/:id/vote
router.post('/:id/vote', authenticateToken, generalRateLimiter, voteOnReview);

// GET /api/v1/reviews/:id/comments
router.get('/:id/comments', authenticateToken, generalRateLimiter, listReviewComments);

// POST /api/v1/reviews/:id/comments (threaded comment via parentCommentId)
router.post('/:id/comments', authenticateToken, generalRateLimiter, addReviewComment);

module.exports = router;


