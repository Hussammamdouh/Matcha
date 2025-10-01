const { getFirestore, setUserCustomClaims } = require('../../../lib/firebase');
const { createRequestLogger } = require('../../lib/logger');
const { inferGenderFromImage } = require('../../lib/aiClient');

async function processSelfie(req, res) {
  const logger = createRequestLogger(req.id);
  const { userId, imageUrl, media } = req.body;

  try {
    const db = getFirestore();

    // Handle direct upload - use uploaded image URL if available
    let finalImageUrl = imageUrl;
    if (Array.isArray(media) && media.length > 0) {
      finalImageUrl = media[0].url;
    }

    if (!finalImageUrl) {
      return res.status(400).json({ 
        ok: false, 
        error: { code: 'MISSING_IMAGE', message: 'Image URL or uploaded file required' } 
      });
    }

    // Call AI service
    const { gender, confidence, decision } = await inferGenderFromImage(finalImageUrl);

    // Persist result
    await db.collection('gender_checks').doc(userId).set({
      userId,
      imageUrl: finalImageUrl,
      gender,
      confidence,
      status: 'evaluated',
      evaluatedAt: new Date(),
    }, { merge: true });

    if (decision === 'approved') {
      // ≥80% female confidence = auto-approve (certified female)
      await setUserCustomClaims(userId, { role: 'user', gv: 'approved' });
      await db.collection('users').doc(userId).update({ 
        genderVerificationStatus: 'approved', 
        aiVerificationData: { gender, confidence, decision },
        updatedAt: new Date() 
      });
      
      logger.info('User auto-approved by AI', { userId, gender, confidence });
      return res.status(200).json({ 
        ok: true, 
        data: { 
          decision: 'approved', 
          gender, 
          confidence,
          message: 'User approved automatically - certified female' 
        } 
      });
    }

    if (decision === 'rejected') {
      // <50% female confidence or male detected = auto-reject and send to IT dashboard
      await setUserCustomClaims(userId, { role: 'user', gv: 'rejected' });
      await db.collection('users').doc(userId).update({ 
        genderVerificationStatus: 'rejected',
        aiVerificationData: { gender, confidence, decision },
        updatedAt: new Date() 
      });
      
      // Create IT ticket for IP banning
      await db.collection('it_tickets').add({
        type: 'registration_review',
        userId,
        reason: gender === 'male' ? 'male_detected' : 'low_female_confidence',
        imageUrl: finalImageUrl,
        aiGender: gender,
        aiConfidence: confidence,
        action: 'ban_ip',
        createdAt: new Date(),
        status: 'open',
        priority: 'high'
      });
      
      logger.warn('User auto-rejected by AI - sent to IT dashboard', { userId, gender, confidence });
      return res.status(200).json({ 
        ok: true, 
        data: { 
          decision: 'rejected', 
          gender, 
          confidence,
          message: 'User rejected automatically - sent to IT dashboard for IP banning' 
        } 
      });
    }

    // 50-79% female confidence = send to admin dashboard for manual review
    await setUserCustomClaims(userId, { role: 'user', gv: 'pending' });
    await db.collection('users').doc(userId).update({ 
      genderVerificationStatus: 'pending_review',
      aiVerificationData: { gender, confidence, decision },
      updatedAt: new Date() 
    });
    
    await db.collection('admin_reviews').add({
      type: 'gender_verification',
      userId,
      imageUrl: finalImageUrl,
      aiGender: gender,
      aiConfidence: confidence,
      reason: 'medium_female_confidence',
      createdAt: new Date(),
      status: 'pending',
      priority: 'medium'
    });
    
    logger.info('User sent to admin dashboard for review', { userId, gender, confidence });
    return res.status(200).json({ 
      ok: true, 
      data: { 
        decision: 'pending', 
        gender, 
        confidence,
        message: 'User sent to admin dashboard for manual review' 
      } 
    });
  } catch (error) {
    logger.error('Selfie processing failed', { error: error.message, userId });
    return res.status(500).json({ ok: false, error: { code: 'SELFIE_PROCESSING_FAILED', message: 'Failed to process selfie' } });
  }
}

module.exports = {
  processSelfie,
};


