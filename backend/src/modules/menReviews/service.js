const { db } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');
const { caches } = require('../../lib/cache');


const logger = createModuleLogger();

/**
 * Aggregates men review votes (red/green/unknown) across communities
 * that a given user is a member of, returning a merged, sorted window
 * without requiring Firestore composite indexes.
 *
 * Data model expectation (collection: men_reviews):
 * - communityId: string
 * - voterId: string
 * - targetId: string | null (hash/identifier of the reviewed man)
 * - label: 'red' | 'green' | 'unknown'
 * - comment: string | null
 * - createdAt: Timestamp
 */
async function aggregateCommunityVotesForUser(userId, options = {}) {
  const { limit = 25, beforeTs = null } = options;

  try {
    const cacheKey = `agg:${userId}:${limit}:${beforeTs ? beforeTs.toISOString() : 'none'}`;
    const cached = caches.reviews.get(cacheKey);
    if (cached) return cached;
    // 1) Find all communities the user has joined
    const membershipSnap = await db
      .collection('community_members')
      .where('userId', '==', userId)
      .get();

    const communityIds = membershipSnap.docs.map(doc => doc.data().communityId);

    if (communityIds.length === 0) {
      return { items: [], counts: { red: 0, green: 0, unknown: 0, total: 0 } };
    }

    // 2) For each community, fetch a small window of recent votes
    // Avoid composite indexes by NOT ordering in Firestore; sort/filter in memory
    const perCommunityFetch = Math.max(limit, 25);

    const perCommunityPromises = communityIds.map(async communityId => {
      const snap = await db
        .collection('men_reviews')
        .where('communityId', '==', communityId)
        .limit(perCommunityFetch)
        .get();

      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (beforeTs) {
        list = list.filter(item => {
          const ts = item.createdAt?.toMillis?.() || 0;
          return ts > 0 && ts < beforeTs.getTime();
        });
      }
      // Sort by createdAt desc in-memory
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      return list.slice(0, perCommunityFetch);
    });

    const perCommunityLists = await Promise.all(perCommunityPromises);

    // 3) Merge all lists and take first N by createdAt desc
    const merged = perCommunityLists.flat();
    merged.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const window = merged.slice(0, limit);

    // 4) Collect unique voterIds and communityIds for name joins
    const voterIds = Array.from(new Set(window.map(v => v.voterId).filter(Boolean)));
    const usedCommunityIds = Array.from(new Set(window.map(v => v.communityId).filter(Boolean)));

    // 5) Fetch users and communities in batches
    const userDocs = await Promise.all(
      voterIds.map(async uid => {
        const doc = await db.collection('users').doc(uid).get();
        return [uid, doc.exists ? doc.data() : null];
      })
    );
    const userMap = Object.fromEntries(userDocs);

    const communityDocs = await Promise.all(
      usedCommunityIds.map(async cid => {
        const doc = await db.collection('communities').doc(cid).get();
        return [cid, doc.exists ? doc.data() : null];
      })
    );
    const communityMap = Object.fromEntries(communityDocs);

    // 6) Decorate items and compute counts
    const counts = { red: 0, green: 0, unknown: 0, total: 0 };
    const items = window.map(v => {
      const label = v.label === 'red' || v.label === 'green' ? v.label : 'unknown';
      counts[label] += 1;
      counts.total += 1;
      const user = v.voterId ? userMap[v.voterId] : null;
      const community = v.communityId ? communityMap[v.communityId] : null;
      return {
        id: v.id,
        communityId: v.communityId,
        communityName: community?.name || null,
        voterId: v.voterId,
        voterNickname: user?.nickname || null,
        targetId: v.targetId || null,
        label,
        comment: v.comment || null,
        createdAt: v.createdAt || null,
      };
    });

    const result = { items, counts };
    caches.reviews.set(cacheKey, result);
    return result;
  } catch (error) {
    logger.error('Failed to aggregate men reviews', {
      error: error.message,
      userId,
    });
    throw error;
  }
}

module.exports = {
  aggregateCommunityVotesForUser,
};


