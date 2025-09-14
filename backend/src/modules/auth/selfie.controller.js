const { getFirestore, setUserCustomClaims } = require('../../../lib/firebase');
const { createRequestLogger } = require('../../lib/logger');
const { inferGenderFromImage } = require('../../lib/aiClient');

async function processSelfie(req, res) {
  const logger = createRequestLogger(req.id);
  const { userId, imageUrl } = req.body;

  try {
    const db = getFirestore();

    // Call AI service
    const { gender, confidence, decision } = await inferGenderFromImage(imageUrl);

    // Persist result
    await db.collection('gender_checks').doc(userId).set({
      userId,
      imageUrl,
      gender,
      confidence,
      status: 'evaluated',
      evaluatedAt: new Date(),
    }, { merge: true });

    if (decision === 'approved') {
      // Approve path: set claim gv=approved and send email verification link (already sent at registration)
      await setUserCustomClaims(userId, { role: 'user', gv: 'approved' });
      await db.collection('users').doc(userId).update({ genderVerificationStatus: 'approved', updatedAt: new Date() });
      return res.status(200).json({ ok: true, data: { decision: 'approved', confidence }, error: null });
    }

    if (decision === 'rejected') {
      // Reject path: mark user and create IT ticket
      await setUserCustomClaims(userId, { role: 'user', gv: 'rejected' });
      await db.collection('users').doc(userId).update({ genderVerificationStatus: 'rejected', updatedAt: new Date() });
      await db.collection('it_tickets').add({
        type: 'registration_review',
        userId,
        reason: 'male_detected',
        imageUrl,
        confidence,
        createdAt: new Date(),
        status: 'open',
      });
      return res.status(200).json({ ok: true, data: { decision: 'rejected', confidence }, error: null });
    }

    // Pending path: send to admin review
    await setUserCustomClaims(userId, { role: 'user', gv: 'pending' });
    await db.collection('users').doc(userId).update({ genderVerificationStatus: 'pending_review', updatedAt: new Date() });
    await db.collection('admin_reviews').add({
      type: 'gender_verification',
      userId,
      imageUrl,
      aiGender: gender,
      aiConfidence: confidence,
      createdAt: new Date(),
      status: 'pending',
    });
    return res.status(200).json({ ok: true, data: { decision: 'pending', confidence }, error: null });
  } catch (error) {
    logger.error('Selfie processing failed', { error: error.message, userId });
    return res.status(500).json({ ok: false, error: { code: 'SELFIE_PROCESSING_FAILED', message: 'Failed to process selfie' } });
  }
}

module.exports = {
  processSelfie,
};


