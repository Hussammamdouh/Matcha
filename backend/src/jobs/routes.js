const express = require('express');
const { asyncHandler } = require('../middlewares/error');

const router = express.Router();

// TODO: Implement Cloud Tasks and scheduled job endpoints
// POST /jobs/send-email - Send email task
// POST /jobs/send-sms - Send SMS task
// POST /jobs/purge-kyc-media - Purge KYC media task
// POST /jobs/purge-deleted-accounts - Purge deleted accounts task

router.post(
  '/send-email',
  asyncHandler(async (req, res) => {
    res.status(200).json({
      ok: true,
      data: { message: 'Job endpoints coming soon' },
      error: null,
      meta: { requestId: req.id },
    });
  })
);

module.exports = router;
