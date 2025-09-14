const { getFirestore } = require('../../lib/firebase');
const { createRequestLogger } = require('../../lib/logger');

async function followUser(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;
  const { targetUid } = req.params;

  try {
    if (!targetUid || targetUid === uid) {
      return res.status(400).json({ ok: false, error: { code: 'INVALID_TARGET', message: 'Invalid target user' } });
    }

    const db = getFirestore();
    const ref = db.collection('follows').doc(`${uid}_${targetUid}`);
    await ref.set({ followerId: uid, followedId: targetUid, createdAt: new Date() }, { merge: true });

    return res.json({ ok: true, data: { following: true, targetUid } });
  } catch (error) {
    logger.error('Failed to follow user', { error: error.message, uid, targetUid });
    return res.status(500).json({ ok: false, error: { code: 'FOLLOW_FAILED', message: 'Failed to follow user' } });
  }
}

async function unfollowUser(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;
  const { targetUid } = req.params;

  try {
    if (!targetUid || targetUid === uid) {
      return res.status(400).json({ ok: false, error: { code: 'INVALID_TARGET', message: 'Invalid target user' } });
    }

    const db = getFirestore();
    const ref = db.collection('follows').doc(`${uid}_${targetUid}`);
    await ref.delete();

    return res.json({ ok: true, data: { following: false, targetUid } });
  } catch (error) {
    logger.error('Failed to unfollow user', { error: error.message, uid, targetUid });
    return res.status(500).json({ ok: false, error: { code: 'UNFOLLOW_FAILED', message: 'Failed to unfollow user' } });
  }
}

async function listFollowing(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;

  try {
    const db = getFirestore();
    const snapshot = await db.collection('follows').where('followerId', '==', uid).get();
    const following = snapshot.docs.map(doc => doc.data().followedId);
    return res.json({ ok: true, data: { following } });
  } catch (error) {
    logger.error('Failed to list following', { error: error.message, uid });
    return res.status(500).json({ ok: false, error: { code: 'LIST_FOLLOWING_FAILED', message: 'Failed to list following' } });
  }
}

async function listFollowers(req, res) {
  const logger = createRequestLogger(req.id);
  const { uid } = req.user;

  try {
    const db = getFirestore();
    const snapshot = await db.collection('follows').where('followedId', '==', uid).get();
    const followers = snapshot.docs.map(doc => doc.data().followerId);
    return res.json({ ok: true, data: { followers } });
  } catch (error) {
    logger.error('Failed to list followers', { error: error.message, uid });
    return res.status(500).json({ ok: false, error: { code: 'LIST_FOLLOWERS_FAILED', message: 'Failed to list followers' } });
  }
}

module.exports = {
  followUser,
  unfollowUser,
  listFollowing,
  listFollowers,
};


