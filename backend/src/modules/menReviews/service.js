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
 * - manName: string | null (name of the reviewed man)
 * - phoneNumber: string | null (phone number of the reviewed man)
 * - createdAt: Timestamp
 */

/**
 * Get all community IDs accessible by the user (member, owner, or moderator)
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
async function getAccessibleCommunityIds(userId) {
  try {
    const [membershipSnap, ownedSnap, modSnap] = await Promise.all([
      db.collection('community_members').where('userId', '==', userId).get(),
      db.collection('communities').where('ownerId', '==', userId).get(),
      // modIds may not exist on some docs; array-contains is safe and will return empty if none
      db.collection('communities').where('modIds', 'array-contains', userId).get().catch(() => ({ empty: true, docs: [] })),
    ]);

    const ids = new Set();
    membershipSnap.docs.forEach(doc => ids.add(doc.data().communityId));
    ownedSnap.docs.forEach(doc => ids.add(doc.id));
    (modSnap.docs || []).forEach(doc => ids.add(doc.id));

    return Array.from(ids);
  } catch (error) {
    logger.warn('Failed to compute accessible community IDs, defaulting to memberships only', { error: error.message, userId });
    try {
      const membershipSnap = await db.collection('community_members').where('userId', '==', userId).get();
      return membershipSnap.docs.map(doc => doc.data().communityId);
    } catch (_) {
      return [];
    }
  }
}

/**
 * Search men reviews by name or phone number
 * @param {string} query - Search query (name or phone number)
 * @param {string} userId - User ID (for community filtering)
 * @param {Object} options - Search options
 * @returns {Object} Search results
 */
async function searchMenReviews(query, userId, options = {}) {
  const { limit = 20, cursor = null } = options;

  try {
    // Get communities accessible by the user (member, owner, moderator)
    const communityIds = await getAccessibleCommunityIds(userId);

    if (communityIds.length === 0) {
      return { items: [], pagination: { hasMore: false, nextCursor: null } };
    }

    // Search in user's communities
    const searchPromises = communityIds.map(communityId => 
      db.collection('men_reviews')
        .where('communityId', '==', communityId)
        .limit(100) // Fetch more to filter
        .get()
    );

    const snapshots = await Promise.all(searchPromises);
    let allReviews = [];

    // Combine results from all communities
    snapshots.forEach(snapshot => {
      snapshot.forEach(doc => {
        allReviews.push({ id: doc.id, ...doc.data() });
      });
    });

    // Filter by search query (case-insensitive)
    const searchQuery = query.toLowerCase().trim();
    const filteredReviews = allReviews.filter(review => {
      const name = (review.manName || '').toLowerCase();
      const phone = (review.phoneNumber || '').toLowerCase();
      const comment = (review.comment || '').toLowerCase();
      
      return name.includes(searchQuery) || 
             phone.includes(searchQuery) || 
             comment.includes(searchQuery);
    });

    // Sort by creation date (newest first)
    filteredReviews.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    // Apply pagination
    const startIndex = cursor ? parseInt(cursor) : 0;
    const paginatedReviews = filteredReviews.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < filteredReviews.length;
    const nextCursor = hasMore ? (startIndex + limit).toString() : null;

    // Enrich with user and community data
    const enrichedReviews = await enrichReviewsWithMetadata(paginatedReviews);

    return {
      items: enrichedReviews,
      pagination: {
        hasMore,
        nextCursor,
        total: filteredReviews.length
      }
    };

  } catch (error) {
    logger.error('Failed to search men reviews', {
      error: error.message,
      query,
      userId
    });
    throw error;
  }
}

/**
 * Enrich reviews with user and community metadata
 * @param {Array} reviews - Array of review objects
 * @returns {Array} Enriched reviews
 */
async function enrichReviewsWithMetadata(reviews) {
  if (reviews.length === 0) return [];

  // Get unique user IDs and community IDs
  const userIds = [...new Set(reviews.map(r => r.voterId).filter(Boolean))];
  const communityIds = [...new Set(reviews.map(r => r.communityId).filter(Boolean))];

  // Fetch user and community data in parallel
  const [userSnapshots, communitySnapshots] = await Promise.all([
    Promise.all(userIds.map(id => db.collection('users').doc(id).get())),
    Promise.all(communityIds.map(id => db.collection('communities').doc(id).get()))
  ]);

  // Create lookup maps
  const userMap = {};
  userSnapshots.forEach((snap, index) => {
    if (snap.exists) {
      userMap[userIds[index]] = snap.data();
    }
  });

  const communityMap = {};
  communitySnapshots.forEach((snap, index) => {
    if (snap.exists) {
      communityMap[communityIds[index]] = snap.data();
    }
  });

  // Enrich reviews
  return reviews.map(review => ({
    ...review,
    voterNickname: userMap[review.voterId]?.nickname || 'Unknown User',
    voterAvatarUrl: userMap[review.voterId]?.avatarUrl || null,
    communityName: communityMap[review.communityId]?.name || 'Unknown Community'
  }));
}

/**
 * Get men that a user has voted on (for filtering out from feeds)
 * @param {string} userId - User ID
 * @returns {Set} Set of men identifiers (targetId or manName+phoneNumber)
 */
async function getUserVotedMen(userId) {
  try {
    // Get communities accessible by the user (member, owner, moderator)
    const communityIds = await getAccessibleCommunityIds(userId);

    if (communityIds.length === 0) {
      return new Set();
    }

    // Get all reviews from user's communities where the user has voted
    const votedMen = new Set();
    
    for (const communityId of communityIds) {
      const reviewsSnap = await db
        .collection('men_reviews')
        .where('communityId', '==', communityId)
        .get();

      for (const reviewDoc of reviewsSnap.docs) {
        const review = reviewDoc.data();
        
        // Check if user has voted on this review
        const voteSnap = await db
          .collection('men_reviews')
          .doc(reviewDoc.id)
          .collection('votes')
          .doc(userId)
          .get();

        if (voteSnap.exists) {
          // User has voted on this man, add to voted set
          const identifier = review.targetId || 
                           `${review.manName || ''}_${review.phoneNumber || ''}`.trim();
          if (identifier) {
            votedMen.add(identifier);
          }
        }
      }
    }

    return votedMen;
  } catch (error) {
    logger.error('Failed to get user voted men', {
      error: error.message,
      userId
    });
    return new Set();
  }
}

/**
 * Get user's voting history (all men they've voted on)
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} Voting history
 */
async function getUserVotingHistory(userId, options = {}) {
  const { limit = 20, cursor = null } = options;

  try {
    // Get communities accessible by the user (member, owner, moderator)
    const communityIds = await getAccessibleCommunityIds(userId);

    if (communityIds.length === 0) {
      return { items: [], pagination: { hasMore: false, nextCursor: null } };
    }

    // Get all reviews from user's communities
    const allReviews = [];
    
    for (const communityId of communityIds) {
      const reviewsSnap = await db
        .collection('men_reviews')
        .where('communityId', '==', communityId)
        .limit(100)
        .get();

      for (const reviewDoc of reviewsSnap.docs) {
        const review = reviewDoc.data();
        
        // Check if user has voted on this review
        const voteSnap = await db
          .collection('men_reviews')
          .doc(reviewDoc.id)
          .collection('votes')
          .doc(userId)
          .get();

        if (voteSnap.exists) {
          const voteData = voteSnap.data();
          allReviews.push({
            id: reviewDoc.id,
            ...review,
            userVote: voteData.label,
            votedAt: voteData.updatedAt
          });
        }
      }
    }

    // Sort by vote date (newest first)
    allReviews.sort((a, b) => {
      const aTime = a.votedAt?.toMillis ? a.votedAt.toMillis() : new Date(a.votedAt || 0).getTime();
      const bTime = b.votedAt?.toMillis ? b.votedAt.toMillis() : new Date(b.votedAt || 0).getTime();
      return bTime - aTime;
    });

    // Apply pagination
    const startIndex = cursor ? parseInt(cursor) : 0;
    const paginatedReviews = allReviews.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < allReviews.length;
    const nextCursor = hasMore ? (startIndex + limit).toString() : null;

    // Enrich with metadata
    const enrichedReviews = await enrichReviewsWithMetadata(paginatedReviews);

    return {
      items: enrichedReviews,
      pagination: {
        hasMore,
        nextCursor,
        total: allReviews.length
      }
    };

  } catch (error) {
    logger.error('Failed to get user voting history', {
      error: error.message,
      userId
    });
    throw error;
  }
}
async function aggregateCommunityVotesForUser(userId, options = {}) {
  const { limit = 25, beforeTs = null, excludeVoted = true } = options;

  try {
    const cacheKey = `agg:${userId}:${limit}:${beforeTs ? beforeTs.toISOString() : 'none'}:${excludeVoted}`;
    const cached = caches.reviews.get(cacheKey);
    if (cached) return cached;

    // Get men that user has already voted on (if excluding voted)
    const votedMen = excludeVoted ? await getUserVotedMen(userId) : new Set();
    // 1) Find all communities the user can access (member, owner, moderator)
    const communityIds = await getAccessibleCommunityIds(userId);

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
    
    // Filter out men that user has already voted on (if excluding voted)
    const filtered = excludeVoted ? merged.filter(review => {
      const identifier = review.targetId || 
                       `${review.manName || ''}_${review.phoneNumber || ''}`.trim();
      return !votedMen.has(identifier);
    }) : merged;
    
    const window = filtered.slice(0, limit);

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
    // For each selected review, fetch its comments and votes to return a full post-like object
    const items = [];
    for (const v of window) {
      const label = v.label === 'red' || v.label === 'green' ? v.label : 'unknown';
      counts[label] += 1;
      counts.total += 1;
      const user = v.voterId ? userMap[v.voterId] : null;
      const community = v.communityId ? communityMap[v.communityId] : null;
      // Fetch comments and votes for this review
      let comments = [];
      let votes = [];
      let actualCounts = { red: 0, green: 0, unknown: 0 };
      try {
        const [commentsSnap, votesSnap] = await Promise.all([
          db.collection('men_reviews').doc(v.id).collection('comments').orderBy('createdAt', 'asc').get(),
          db.collection('men_reviews').doc(v.id).collection('votes').get(),
        ]);
        comments = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        votes = votesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Calculate actual vote counts from the votes subcollection
        votes.forEach(vote => {
          if (vote.label && actualCounts.hasOwnProperty(vote.label)) {
            actualCounts[vote.label]++;
          }
        });
      } catch (_) {
        // Fallback to the counts from the review document if fetching fails
        actualCounts = v.counts || { red: 0, green: 0, unknown: 0 };
      }

      items.push({
        id: v.id,
        communityId: v.communityId,
        communityName: community?.name || null,
        voterId: v.voterId,
        voterNickname: user?.nickname || null,
        voterAvatarUrl: user?.avatarUrl || null,
        targetId: v.targetId || null,
        label,
        comment: v.comment || null,
        media: Array.isArray(v.media) ? v.media : [],
        counts: actualCounts,
        createdAt: v.createdAt || null,
        comments,
        votes,
      });
    }

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
  searchMenReviews,
  enrichReviewsWithMetadata,
  getUserVotedMen,
  getUserVotingHistory,
};


