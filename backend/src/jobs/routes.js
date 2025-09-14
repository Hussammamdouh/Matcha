const express = require('express');
const { asyncHandler } = require('../middlewares/error');
const { createRateLimiter } = require('../middlewares/rateLimit');
const { body } = require('express-validator');
const validate = require('../middlewares/validation').validateBody;

const router = express.Router();
const { getStorage } = require('../lib/firebase');
const { createModuleLogger } = require('../lib/logger');
const logger = createModuleLogger('jobs');

// Minimal in-process jobs (no external queue) with DTO shape and validation
// POST /jobs/send-email - Send email task (stub)
// POST /jobs/purge-men-originals - Purge non-readable men-review originals older than retention

const jobLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10 });

router.post(
  '/send-email',
  jobLimiter,
  validate([
    body('to').isEmail().withMessage('Valid recipient email required'),
    body('subject').isString().isLength({ min: 1, max: 200 }),
    body('text').optional().isString(),
    body('html').optional().isString(),
  ]),
  asyncHandler(async (req, res) => {
    res.status(202).json({
      ok: true,
      data: { message: 'Email job accepted' },
      error: null,
      meta: { requestId: req.id },
    });
  })
);

router.post(
  '/purge-men-originals',
  jobLimiter,
  asyncHandler(async (req, res) => {
    // Implement retention-based purge without blocking
    // Read retention from Firestore settings, fallback to env default
    let retentionDays = parseInt(process.env.MEN_ORIGINAL_RETENTION_DAYS || '7', 10);
    try {
      const { getFirestore } = require('../lib/firebase');
      const db = getFirestore();
      const settingsDoc = await db.collection('system').doc('settings').get();
      if (settingsDoc.exists && Number.isInteger(settingsDoc.data().menOriginalRetentionDays)) {
        retentionDays = settingsDoc.data().menOriginalRetentionDays;
      }
    } catch (_) {}
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    try {
      const storage = getStorage();
      const bucket = storage.bucket();
      // List files under men/subjects/*/original/* (prefix scan)
      const [files] = await bucket.getFiles({ prefix: 'men/subjects/', autoPaginate: false });
      const toDelete = files.filter(f => f.name.includes('/original/') && f.metadata && Date.parse(f.metadata.timeCreated) < cutoff);
      // Delete in background (fire and forget)
      Promise.allSettled(toDelete.map(f => f.delete().catch(() => {}))).then(results => {
        const deleted = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.length - deleted;
        logger.info('Purge men originals completed', { deleted, failed, retentionDays });
      });
    } catch (error) {
      logger.error('Failed to schedule purge', { error: error.message });
    }
    res.status(202).json({
      ok: true,
      data: { message: 'Purge job accepted' },
      error: null,
      meta: { requestId: req.id },
    });
  })
);

module.exports = router;
