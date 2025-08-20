const express = require('express');
const { authenticateToken } = require('../../middlewares/auth');
const { asyncHandler } = require('../../middlewares/error');

const router = express.Router();

// TODO: Implement audit log endpoints
// GET /audit - View audit logs (admin only)

router.get(
  '/',
  authenticateToken,
  asyncHandler(async (req, res) => {
    res.status(200).json({
      ok: true,
      data: { message: 'Audit log endpoints coming soon' },
      error: null,
      meta: { requestId: req.id },
    });
  })
);

module.exports = router;
