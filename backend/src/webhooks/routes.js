const express = require('express');
const { asyncHandler } = require('../middlewares/error');

const router = express.Router();

// TODO: Implement KYC provider webhooks
// POST /webhooks/kyc/:provider - Handle KYC provider webhooks

router.post(
  '/kyc/:provider',
  asyncHandler(async (req, res) => {
    res.status(200).json({
      ok: true,
      data: { message: 'KYC webhook endpoints coming soon' },
      error: null,
      meta: { requestId: req.id },
    });
  })
);

module.exports = router;
