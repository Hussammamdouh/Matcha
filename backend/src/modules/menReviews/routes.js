const express = require('express');
const { authenticateToken } = require('../../middlewares/auth');
const { generalRateLimiter } = require('../../middlewares/rateLimit');
const { getAggregatedReviews, searchMenReviewsController, getUserVotingHistoryController, createReview, getReview, voteOnReview, listReviewComments, addReviewComment, listCommunityReviews, updateReview, deleteReview } = require('./controller');
const directUpload = require('../../middlewares/directUpload');
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

// GET /api/v1/reviews/search - Search men reviews by name or phone number
router.get(
  '/search',
  authenticateToken,
  generalRateLimiter,
  searchMenReviewsController
);

// GET /api/v1/reviews/history - Get user's voting history
router.get(
  '/history',
  authenticateToken,
  generalRateLimiter,
  getUserVotingHistoryController
);

// POST /api/v1/reviews
// Accept direct multipart uploads similar to posts/comments
router.post(
  '/',
  authenticateToken,
  generalRateLimiter,
  directUpload({ namespace: 'men-reviews' }),
  createReview
);

// GET /api/v1/reviews/:id
router.get('/:id', authenticateToken, generalRateLimiter, getReview);

// GET /api/v1/reviews/community/:communityId
router.get('/community/:communityId', authenticateToken, generalRateLimiter, listCommunityReviews);

// POST /api/v1/reviews/:id/vote
router.post('/:id/vote', authenticateToken, generalRateLimiter, voteOnReview);

// GET /api/v1/reviews/:id/comments
router.get('/:id/comments', authenticateToken, generalRateLimiter, listReviewComments);

// POST /api/v1/reviews/:id/comments (threaded comment via parentCommentId)
router.post('/:id/comments', authenticateToken, generalRateLimiter, addReviewComment);

// PATCH /api/v1/reviews/:id
router.patch('/:id', authenticateToken, generalRateLimiter, directUpload({ namespace: 'men-reviews' }), updateReview);

// DELETE /api/v1/reviews/:id
router.delete('/:id', authenticateToken, generalRateLimiter, deleteReview);

module.exports = router;


