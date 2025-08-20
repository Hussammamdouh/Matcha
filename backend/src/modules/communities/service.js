const { getFirestore } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');

const db = getFirestore();
const logger = createModuleLogger();

/**
 * Communities service for Matcha
 * Handles all Firestore operations for communities
 */

/**
 * Create a new community
 *
 * @param {Object} communityData - Community data
 * @param {string} userId - User ID creating the community
 * @returns {Object} Created community
 */
async function createCommunity(communityData, userId) {
  try {
    // Check if community name or slug already exists
    const nameQuery = await db
      .collection('communities')
      .where('name', '==', communityData.name)
      .limit(1)
      .get();

    if (!nameQuery.empty) {
      throw new Error('Community name already exists');
    }

    const slugQuery = await db
      .collection('communities')
      .where('slug', '==', communityData.slug)
      .limit(1)
      .get();

    if (!slugQuery.empty) {
      throw new Error('Community slug already exists');
    }

    // Create community document
    const communityRef = db.collection('communities').doc();
    const community = {
      id: communityRef.id,
      ...communityData,
      createdBy: userId,
      ownerId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      memberCount: 1,
      postCount: 0,
      modIds: [userId],
      upvotes: 0,
      downvotes: 0,
      score: 0,
    };

    await communityRef.set(community);

    // Add creator as member
    await db.collection('community_members').add({
      userId,
      communityId: communityRef.id,
      role: 'owner',
      joinedAt: new Date(),
    });

    logger.info('Community created successfully', {
      communityId: communityRef.id,
      name: community.name,
      createdBy: userId,
    });

    return community;
  } catch (error) {
    logger.error('Failed to create community', {
      error: error.message,
      communityData,
      userId,
    });
    throw error;
  }
}

/**
 * Get community by ID
 *
 * @param {string} communityId - Community ID
 * @param {string} userId - Optional user ID for membership check
 * @returns {Object|null} Community data or null if not found
 */
async function getCommunity(communityId, userId = null) {
  try {
    const communityDoc = await db.collection('communities').doc(communityId).get();

    if (!communityDoc.exists) {
      return null;
    }

    const community = { id: communityDoc.id, ...communityDoc.data() };

    // Check user membership if userId provided
    if (userId) {
      const membershipDoc = await db
        .collection('community_members')
        .where('userId', '==', userId)
        .where('communityId', '==', communityId)
        .limit(1)
        .get();

      community.isMember = !membershipDoc.empty;
      if (community.isMember) {
        const membership = membershipDoc.docs[0].data();
        community.userRole = membership.role;
      }
    }

    return community;
  } catch (error) {
    logger.error('Failed to get community', {
      error: error.message,
      communityId,
      userId,
    });
    throw error;
  }
}

/**
 * List communities with filtering and pagination
 *
 * @param {Object} options - Query options
 * @param {string} options.q - Search query
 * @param {string} options.category - Category filter
 * @param {string} options.sort - Sort order
 * @param {number} options.pageSize - Page size
 * @param {string} options.cursor - Pagination cursor
 * @returns {Object} Paginated communities list
 */
async function listCommunities(options = {}) {
  try {
    const { q = '', category = '', sort = 'trending', pageSize = 20, cursor = null } = options;

    let query = db.collection('communities');

    // Apply filters
    if (category) {
      query = query.where('category', '==', category);
    }

    if (q) {
      // Simple prefix search (can be enhanced with Algolia later)
      // Note: This requires a composite index on (name ASC, createdAt DESC)
      // For now, we'll filter in memory to avoid composite indexes
      query = query.orderBy('name', 'asc');
    }

    // Apply sorting
    switch (sort) {
      case 'trending':
        query = query.orderBy('score', 'desc');
        break;
      case 'new':
        query = query.orderBy('createdAt', 'desc');
        break;
      case 'top':
        query = query.orderBy('memberCount', 'desc');
        break;
      default:
        query = query.orderBy('createdAt', 'desc');
    }

    // Apply pagination
    if (cursor) {
      // TODO: Implement cursor-based pagination
      // For now, use offset
    }

    query = query.limit(pageSize);

    const snapshot = await query.get();
    const communities = [];

    snapshot.forEach(doc => {
      communities.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Generate next cursor
    let nextCursor = null;
    if (communities.length === pageSize) {
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({
          id: lastDoc.id,
          sort,
          timestamp: Date.now(),
        })
      ).toString('base64');
    }

    return {
      communities,
      pagination: {
        pageSize,
        hasMore: communities.length === pageSize,
        nextCursor,
      },
    };
  } catch (error) {
    logger.error('Failed to list communities', {
      error: error.message,
      options,
    });
    throw error;
  }
}

/**
 * Update community
 *
 * @param {string} communityId - Community ID
 * @param {Object} updateData - Data to update
 * @param {string} userId - User ID performing the update
 * @returns {Object} Updated community
 */
async function updateCommunity(communityId, updateData, userId) {
  try {
    const communityRef = db.collection('communities').doc(communityId);

    // Check if user has permission to update
    const communityDoc = await communityRef.get();
    if (!communityDoc.exists) {
      throw new Error('Community not found');
    }

    const community = communityDoc.data();
    if (community.ownerId !== userId && !community.modIds.includes(userId)) {
      throw new Error('Insufficient permissions to update community');
    }

    // Check name/slug uniqueness if updating
    if (updateData.name && updateData.name !== community.name) {
      const nameQuery = await db
        .collection('communities')
        .where('name', '==', updateData.name)
        .get();
      
      // Filter out current community in memory
      const duplicateName = nameQuery.docs.find(doc => doc.id !== communityId);

      if (duplicateName) {
        throw new Error('Community name already exists');
      }
    }

    if (updateData.slug && updateData.slug !== community.slug) {
      const slugQuery = await db
        .collection('communities')
        .where('slug', '==', updateData.slug)
        .where('__name__', '!=', communityId)
        .limit(1)
        .get();

      if (!slugQuery.empty) {
        throw new Error('Community slug already exists');
      }
    }

    // Update community
    const updatePayload = {
      ...updateData,
      updatedAt: new Date(),
    };

    await communityRef.update(updatePayload);

    logger.info('Community updated successfully', {
      communityId,
      updatedBy: userId,
      updatedFields: Object.keys(updateData),
    });

    return { id: communityId, ...community, ...updatePayload };
  } catch (error) {
    logger.error('Failed to update community', {
      error: error.message,
      communityId,
      updateData,
      userId,
    });
    throw error;
  }
}

/**
 * Join a community
 *
 * @param {string} communityId - Community ID
 * @param {string} userId - User ID joining
 * @returns {Object} Membership data
 */
async function joinCommunity(communityId, userId) {
  try {
    const communityRef = db.collection('communities').doc(communityId);

    // Check if community exists
    const communityDoc = await communityRef.get();
    if (!communityDoc.exists) {
      throw new Error('Community not found');
    }

    const community = communityDoc.data();

    // Check if already a member
    const existingMembership = await db
      .collection('community_members')
      .where('userId', '==', userId)
      .where('communityId', '==', communityId)
      .limit(1)
      .get();

    if (!existingMembership.empty) {
      throw new Error('Already a member of this community');
    }

    // Add membership
    const membershipRef = await db.collection('community_members').add({
      userId,
      communityId,
      role: 'member',
      joinedAt: new Date(),
    });

    // Update community member count
    await communityRef.update({
      memberCount: community.memberCount + 1,
      updatedAt: new Date(),
    });

    logger.info('User joined community', {
      communityId,
      userId,
      membershipId: membershipRef.id,
    });

    return {
      id: membershipRef.id,
      userId,
      communityId,
      role: 'member',
      joinedAt: new Date(),
    };
  } catch (error) {
    logger.error('Failed to join community', {
      error: error.message,
      communityId,
      userId,
    });
    throw error;
  }
}

/**
 * Leave a community
 *
 * @param {string} communityId - Community ID
 * @param {string} userId - User ID leaving
 * @returns {boolean} Success status
 */
async function leaveCommunity(communityId, userId) {
  try {
    const communityRef = db.collection('communities').doc(communityId);

    // Check if community exists
    const communityDoc = await communityRef.get();
    if (!communityDoc.exists) {
      throw new Error('Community not found');
    }

    const community = communityDoc.data();

    // Check if user is the owner
    if (community.ownerId === userId) {
      throw new Error('Community owner cannot leave. Transfer ownership first.');
    }

    // Find and remove membership
    const membershipQuery = await db
      .collection('community_members')
      .where('userId', '==', userId)
      .where('communityId', '==', communityId)
      .limit(1)
      .get();

    if (membershipQuery.empty) {
      throw new Error('Not a member of this community');
    }

    const membershipDoc = membershipQuery.docs[0];
    await membershipDoc.ref.delete();

    // Remove from moderators if applicable
    if (community.modIds.includes(userId)) {
      const newModIds = community.modIds.filter(id => id !== userId);
      await communityRef.update({
        modIds: newModIds,
        updatedAt: new Date(),
      });
    }

    // Update community member count
    await communityRef.update({
      memberCount: Math.max(0, community.memberCount - 1),
      updatedAt: new Date(),
    });

    logger.info('User left community', {
      communityId,
      userId,
    });

    return true;
  } catch (error) {
    logger.error('Failed to leave community', {
      error: error.message,
      communityId,
      userId,
    });
    throw error;
  }
}

/**
 * Get community moderators
 *
 * @param {string} communityId - Community ID
 * @returns {Array} List of moderators
 */
async function getModerators(communityId) {
  try {
    const communityDoc = await db.collection('communities').doc(communityId).get();

    if (!communityDoc.exists) {
      throw new Error('Community not found');
    }

    const community = communityDoc.data();
    const moderatorIds = [...community.modIds, community.ownerId];

    // Get moderator details
    const moderators = [];
    for (const modId of moderatorIds) {
      const userDoc = await db.collection('users').doc(modId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        moderators.push({
          id: modId,
          nickname: userData.nickname,
          avatarUrl: userData.avatarUrl,
          role: modId === community.ownerId ? 'owner' : 'moderator',
        });
      }
    }

    return moderators;
  } catch (error) {
    logger.error('Failed to get community moderators', {
      error: error.message,
      communityId,
    });
    throw error;
  }
}

/**
 * Check if user is member of community
 *
 * @param {string} communityId - Community ID
 * @param {string} userId - User ID
 * @returns {Object|null} Membership data or null
 */
async function checkMembership(communityId, userId) {
  try {
    const membershipQuery = await db
      .collection('community_members')
      .where('userId', '==', userId)
      .where('communityId', '==', communityId)
      .limit(1)
      .get();

    if (membershipQuery.empty) {
      return null;
    }

    const membership = membershipQuery.docs[0].data();
    return {
      id: membershipQuery.docs[0].id,
      ...membership,
    };
  } catch (error) {
    logger.error('Failed to check community membership', {
      error: error.message,
      communityId,
      userId,
    });
    return null;
  }
}

module.exports = {
  createCommunity,
  getCommunity,
  listCommunities,
  updateCommunity,
  joinCommunity,
  leaveCommunity,
  getModerators,
  checkMembership,
};
