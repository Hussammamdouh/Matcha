const { db } = require('./firebase');
const { runTransaction } = require('./firestoreTx');
const logger = require('./logger');

/**
 * Shared ranking helpers for hotScore calculations and feed ordering
 * Implements Reddit-style hot scoring algorithm optimized for single-field indexes
 */

/**
 * Calculate hot score using Reddit's algorithm
 * @param {number} upvotes - Number of upvotes
 * @param {number} downvotes - Number of downvotes
 * @param {Date} createdAt - Creation timestamp
 * @returns {number} Hot score
 */
function calculateHotScore(upvotes, downvotes, createdAt) {
  const score = upvotes - downvotes;
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  const seconds = (Date.now() - createdAt.getTime()) / 1000;
  
  // Reddit's hot score formula
  return Math.round((order + sign * seconds / 45000) * 1000000);
}

/**
 * Calculate trending score based on recent activity
 * @param {number} totalVotes - Total votes (up + down)
 * @param {Date} lastActivity - Last activity timestamp
 * @param {number} commentCount - Number of comments
 * @returns {number} Trending score
 */
function calculateTrendingScore(totalVotes, lastActivity, commentCount) {
  const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
  const timeDecay = Math.exp(-hoursSinceActivity / 24); // 24-hour half-life
  const engagementBonus = Math.log10(commentCount + 1) * 0.1;
  
  return Math.round((totalVotes * timeDecay + engagementBonus) * 1000000);
}

/**
 * Update hot score for a post/comment with transaction safety
 * @param {string} docPath - Document path to update
 * @param {Object} voteData - Current vote counts and timestamps
 * @returns {Promise<void>}
 */
async function updateHotScore(docPath, voteData) {
  const { upvotes = 0, downvotes = 0, createdAt, lastActivity } = voteData;
  
  if (!createdAt) {
    throw new Error('createdAt is required for hot score calculation');
  }
  
  const hotScore = calculateHotScore(upvotes, downvotes, createdAt);
  const trendingScore = calculateTrendingScore(upvotes + downvotes, lastActivity || createdAt, voteData.commentCount || 0);
  
  return runTransaction(async (transaction) => {
    const docRef = db.doc(docPath);
    const doc = await transaction.get(docRef);
    
    if (!doc.exists) {
      throw new Error(`Document not found: ${docPath}`);
    }
    
    transaction.update(docRef, {
      hotScore,
      trendingScore,
      updatedAt: new Date()
    });
    
    logger.debug('Hot score updated', {
      docPath,
      upvotes,
      downvotes,
      hotScore,
      trendingScore
    });
  });
}

/**
 * Batch update hot scores for multiple documents
 * @param {Array<{docPath: string, voteData: Object}>} updates
 * @returns {Promise<void>}
 */
async function batchUpdateHotScores(updates) {
  return runTransaction(async (transaction) => {
    for (const update of updates) {
      const { docPath, voteData } = update;
      const { upvotes = 0, downvotes = 0, createdAt, lastActivity } = voteData;
      
      if (!createdAt) {
        logger.warn('Skipping hot score update - missing createdAt', { docPath });
        continue;
      }
      
      const hotScore = calculateHotScore(upvotes, downvotes, createdAt);
      const trendingScore = calculateTrendingScore(upvotes + downvotes, lastActivity || createdAt, voteData.commentCount || 0);
      
      const docRef = db.doc(docPath);
      transaction.update(docRef, {
        hotScore,
        trendingScore,
        updatedAt: new Date()
      });
    }
    
    logger.debug('Batch hot score update completed', {
      count: updates.length
    });
  });
}

/**
 * Get feed documents ordered by hot score with cursor-based pagination
 * @param {string} collectionPath - Collection to query
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of documents to return
 * @param {string} options.cursor - Cursor for pagination
 * @param {string} options.orderBy - Field to order by (default: hotScore)
 * @param {Object} options.filters - Additional filters
 * @returns {Promise<{documents: Array, nextCursor: string|null}>}
 */
async function getFeedDocuments(collectionPath, options = {}) {
  const {
    limit = 20,
    cursor = null,
    orderBy = 'hotScore',
    filters = {}
  } = options;
  
  let query = db.collection(collectionPath);
  
  // Apply filters
  for (const [field, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      query = query.where(field, '==', value);
    }
  }
  
  // Apply cursor-based pagination
  if (cursor) {
    const cursorDoc = await db.doc(cursor).get();
    if (cursorDoc.exists) {
      query = query.orderBy(orderBy, 'desc').startAfter(cursorDoc);
    }
  } else {
    query = query.orderBy(orderBy, 'desc');
  }
  
  // Apply limit
  query = query.limit(limit + 1); // +1 to check if there are more results
  
  const snapshot = await query.get();
  const documents = [];
  
  snapshot.forEach(doc => {
    documents.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  // Check if there are more results
  const hasMore = documents.length > limit;
  const nextCursor = hasMore ? documents[documents.length - 2].id : null;
  
  // Remove the extra document used for pagination
  if (hasMore) {
    documents.pop();
  }
  
  return {
    documents,
    nextCursor
  };
}

/**
 * Update community member count atomically
 * @param {string} communityId - Community ID
 * @param {number} delta - Change in member count (+1 for join, -1 for leave)
 * @returns {Promise<void>}
 */
async function updateMemberCount(communityId, delta) {
  const communityPath = `communities/${communityId}`;
  
  return runTransaction(async (transaction) => {
    const communityRef = db.doc(communityPath);
    const communityDoc = await transaction.get(communityRef);
    
    if (!communityDoc.exists) {
      throw new Error(`Community not found: ${communityId}`);
    }
    
    const currentCount = communityDoc.data().memberCount || 0;
    const newCount = Math.max(0, currentCount + delta);
    
    transaction.update(communityRef, {
      memberCount: newCount,
      updatedAt: new Date()
    });
    
    logger.debug('Community member count updated', {
      communityId,
      oldCount: currentCount,
      newCount,
      delta
    });
  });
}

/**
 * Calculate engagement score for a post/comment
 * @param {Object} metrics - Engagement metrics
 * @returns {number} Engagement score
 */
function calculateEngagementScore(metrics) {
  const {
    upvotes = 0,
    downvotes = 0,
    commentCount = 0,
    saveCount = 0,
    reportCount = 0,
    createdAt,
    lastActivity
  } = metrics;
  
  const totalVotes = upvotes + downvotes;
  const voteRatio = totalVotes > 0 ? upvotes / totalVotes : 0;
  const timeDecay = createdAt ? Math.exp(-(Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 1;
  const activityBonus = lastActivity ? Math.exp(-(Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 6)) : 1;
  
  // Weighted engagement calculation
  const engagement = (
    voteRatio * 0.4 +
    (commentCount / 100) * 0.3 +
    (saveCount / 50) * 0.2 +
    (1 - reportCount / 10) * 0.1
  );
  
  return Math.round(engagement * timeDecay * activityBonus * 1000000);
}

module.exports = {
  calculateHotScore,
  calculateTrendingScore,
  updateHotScore,
  batchUpdateHotScores,
  getFeedDocuments,
  updateMemberCount,
  calculateEngagementScore
};
