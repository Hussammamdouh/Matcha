const { db } = require('../../../lib/firebase');
const { createModuleLogger } = require('../../lib/logger');


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
const { encodeCursor, decodeCursor } = require('../../lib/pagination');

const { caches } = require('../../lib/cache');

async function listCommunities(options = {}) {
  try {
    const { q = '', category = '', sort = 'trending', pageSize = 20, cursor = null } = options;

    const cacheKey = `communities:${q}:${category}:${sort}:${pageSize}:${cursor || 'start'}`;
    const cached = caches.communities.get(cacheKey);
    if (cached) return cached;

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

    // Apply pagination (cursor based on createdAt,id)
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        // Firestore needs the field to orderBy and a doc snapshot or explicit values for startAfter
        // Since we order by one field, we can fetch the reference doc
        try {
          const docSnap = await db.collection('communities').doc(decoded.id).get();
          if (docSnap.exists) {
            query = query.startAfter(docSnap);
          }
        } catch (_) {}
      }
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
      nextCursor = encodeCursor({ id: lastDoc.id, createdAt: lastDoc.get('createdAt') });
    }

    const result = {
      communities,
      pagination: {
        pageSize,
        hasMore: communities.length === pageSize,
        nextCursor,
      },
    };
    caches.communities.set(cacheKey, result);
    return result;
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
    if (community.ownerId !== userId && !(community.modIds || []).includes(userId)) {
      throw new Error('Insufficient permissions to update community');
    }

    // Check name/slug uniqueness if updating
    if (updateData.name && updateData.name !== community.name) {
      const nameQuery = await db
        .collection('communities')
        .where('name', '==', updateData.name)
        .limit(1)
        .get();

      if (!nameQuery.empty && nameQuery.docs[0].id !== communityId) {
        throw new Error('Community name already exists');
      }
    }

    if (updateData.slug && updateData.slug !== community.slug) {
      const slugQuery = await db
        .collection('communities')
        .where('slug', '==', updateData.slug)
        .limit(1)
        .get();

      if (!slugQuery.empty && slugQuery.docs[0].id !== communityId) {
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
    if ((community.modIds || []).includes(userId)) {
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
 * List community members with basic user info
 * @param {string} communityId
 * @param {Object} options
 */
async function listMembers(communityId, options = {}) {
  try {
    const { pageSize = 20, cursor = null } = options;
    const membershipSnap = await db
      .collection('community_members')
      .where('communityId', '==', communityId)
      .get();

    const all = membershipSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort by joinedAt desc
    all.sort((a, b) => {
      const at = a.joinedAt?.toDate ? a.joinedAt.toDate() : new Date(a.joinedAt);
      const bt = b.joinedAt?.toDate ? b.joinedAt.toDate() : new Date(b.joinedAt);
      return bt - at;
    });

    let start = 0;
    if (cursor) {
      const idx = all.findIndex(x => x.id === cursor);
      if (idx >= 0) start = idx + 1;
    }
    const page = all.slice(start, start + Math.min(pageSize, 100));
    const hasMore = start + page.length < all.length;

    // Hydrate minimal user info
    const userIds = page.map(m => m.userId);
    const usersSnap = userIds.length
      ? await db.collection('users').where('uid', 'in', userIds).get()
      : { empty: true, docs: [] };
    const usersMap = {};
    if (!usersSnap.empty) {
      usersSnap.docs.forEach(doc => {
        const u = doc.data();
        usersMap[u.uid] = { uid: u.uid, nickname: u.nickname, avatarUrl: u.avatarUrl || null };
      });
    }

    const members = page.map(m => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      user: usersMap[m.userId] || { uid: m.userId },
    }));

    return {
      members,
      pagination: { pageSize: page.length, hasMore, nextCursor: hasMore ? page[page.length - 1].id : null },
    };
  } catch (error) {
    logger.error('Failed to list community members', { error: error.message, communityId, options });
    throw error;
  }
}

/**
 * Delete community with cascade cleanup
 * - Only owner or platform admin can delete
 * - Soft-delete content or remove as appropriate
 * @param {string} communityId
 * @param {string} userId
 */
async function deleteCommunity(communityId, userId) {
  try {
    // Load community
    const communityRef = db.collection('communities').doc(communityId);
    const communityDoc = await communityRef.get();
    if (!communityDoc.exists) throw new Error('Community not found');
    const community = communityDoc.data();

    // Check permission: owner or admin
    let isAdmin = false;
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      const role = userDoc.exists ? (userDoc.data().role || userDoc.data().adminRole) : null;
      isAdmin = role === 'admin' || role === 'super_admin';
    } catch (_) {}
    const isOwner = community.ownerId === userId;
    if (!isOwner && !isAdmin) {
      throw new Error('Insufficient permissions to delete community');
    }

    // Best-effort: delete community icon/banner media
    try {
      const { getProvider } = require('../../lib/storageProvider');
      const provider = getProvider();
      const urls = [];
      if (community.icon) urls.push(community.icon);
      if (community.bannerUrl) urls.push(community.bannerUrl);

      function extractObjectPathFromUrl(url) {
        try {
          if (!url || typeof url !== 'string') return null;
          if (url.includes('res.cloudinary.com')) {
            const idx = url.indexOf('/upload/');
            if (idx !== -1) {
              const after = url.substring(idx + '/upload/'.length);
              const parts = after.split('/');
              const maybeVersion = parts[0];
              const startIndex = /^v\d+$/.test(maybeVersion) ? 1 : 0;
              const pathParts = parts.slice(startIndex);
              const last = pathParts.pop() || '';
              const withoutExt = last.includes('.') ? last.substring(0, last.lastIndexOf('.')) : last;
              const publicId = [...pathParts, withoutExt].join('/');
              return publicId || null;
            }
          }
          if (url.includes('storage.googleapis.com')) {
            const u = new URL(url);
            const segments = u.pathname.split('/').filter(Boolean);
            if (segments.length >= 2) return decodeURIComponent(segments.slice(1).join('/'));
          }
          if (url.startsWith('gs://')) {
            const pathStart = url.indexOf('/', 'gs://'.length);
            if (pathStart > 0) return url.substring(pathStart + 1);
          }
          return null;
        } catch (_) { return null; }
      }

      const deletions = [];
      for (const u of urls) {
        const objectPath = extractObjectPathFromUrl(u);
        if (objectPath) deletions.push(provider.deleteFile(objectPath).catch(() => false));
      }
      if (deletions.length > 0) await Promise.allSettled(deletions);
    } catch (e) {
      logger.warn('Failed to delete community media (continuing)', { communityId, error: e.message });
    }

    // Cascade: soft-delete posts in this community (and use existing post cascade for comments/media/likes)
    try {
      const postsSnap = await db
        .collection('posts')
        .where('communityId', '==', communityId)
        .where('isDeleted', '==', false)
        .get();
      if (!postsSnap.empty) {
        const postsService = require('../posts/service');
        for (const doc of postsSnap.docs) {
          await postsService.deletePost(doc.id, community.ownerId);
        }
      }
    } catch (e) {
      logger.warn('Failed to cascade delete community posts (continuing)', { communityId, error: e.message });
    }

    // Remove memberships
    try {
      const membershipsSnap = await db
        .collection('community_members')
        .where('communityId', '==', communityId)
        .get();
      if (!membershipsSnap.empty) {
        const batch = db.batch();
        membershipsSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e) {
      logger.warn('Failed to delete community memberships (continuing)', { communityId, error: e.message });
    }

    // Finally, delete the community document
    await communityRef.delete();

    logger.info('Community deleted successfully', { communityId, deletedBy: userId });
    return true;
  } catch (error) {
    logger.error('Failed to delete community', { error: error.message, communityId, userId });
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
  listMembers,
  deleteCommunity,
};
