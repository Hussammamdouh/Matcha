const { query } = require('express-validator');


const getAggregatedReviewsValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be an integer between 1 and 100'),
  query('beforeTs')
    .optional()
    .isISO8601()
    .withMessage('beforeTs must be an ISO date string'),
];

module.exports = {
  getAggregatedReviewsValidation,
};


