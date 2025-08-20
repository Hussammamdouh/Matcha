const express = require('express');
const { verifyFirebaseIdToken } = require('../../middlewares/firebaseAuth');
const { asyncHandler } = require('../../middlewares/error');

const router = express.Router();

// TODO: Implement session management endpoints
// GET /me/sessions - List user sessions
// DELETE /me/sessions/:sessionId - Revoke specific session

router.get(
  '/',
  verifyFirebaseIdToken,
  asyncHandler(async (req, res) => {
    res.status(200).json({
      ok: true,
      data: { message: 'Session management endpoints coming soon' },
      error: null,
      meta: { requestId: req.id },
    });
  })
);

module.exports = router;
