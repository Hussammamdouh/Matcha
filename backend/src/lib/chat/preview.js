const { sanitizeChatText, buildMessagePreview } = require('./sanitize');

/**
 * Build a preview of the last message in a conversation
 * @param {Object} message - Message object
 * @param {number} maxLength - Maximum preview length (default: 100)
 * @returns {string} Message preview
 */
function buildLastMessagePreview(message, maxLength = 100) {
  if (!message) return '';
  
  switch (message.type) {
    case 'text':
      return buildMessagePreview(message.text, maxLength);
    
    case 'image':
      return '📷 Image';
    
    case 'audio':
      return '🎵 Audio';
    
    default:
      return 'Message';
  }
}

/**
 * Build conversation summary for list views
 * @param {Object} conversation - Conversation object
 * @param {Object} lastMessage - Last message object
 * @param {Array} participants - Array of participant objects
 * @returns {Object} Conversation summary
 */
function buildConversationSummary(conversation, lastMessage, participants) {
  const summary = {
    id: conversation.id,
    type: conversation.type,
    title: conversation.title,
    icon: conversation.icon,
    memberCount: participants.length,
    lastMessageAt: lastMessage ? lastMessage.createdAt : conversation.createdAt,
    lastMessagePreview: buildLastMessagePreview(lastMessage),
    isLocked: conversation.isLocked || false,
    createdAt: conversation.createdAt,
    createdBy: conversation.createdBy,
  };

  // Add participant info (limited to avoid PII exposure)
  summary.participants = participants.map(p => ({
    id: p.userId,
    nickname: p.nickname,
    avatarUrl: p.avatarUrl,
    role: p.role,
    lastReadAt: p.lastReadAt,
    isTyping: p.isTyping || false,
  }));

  return summary;
}

/**
 * Build message summary for list views
 * @param {Object} message - Message object
 * @param {Object} author - Author user object
 * @returns {Object} Message summary
 */
function buildMessageSummary(message, author) {
  const summary = {
    id: message.id,
    conversationId: message.conversationId,
    type: message.type,
    text: message.text,
    media: message.media,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    isDeleted: message.isDeleted || false,
    deletedByMod: message.deletedByMod || false,
    replyToMessageId: message.replyToMessageId,
    mentions: message.mentions || [],
  };

  // Add author info (limited to avoid PII exposure)
  if (author) {
    summary.author = {
      id: author.uid,
      nickname: author.nickname || author.displayName,
      avatarUrl: author.avatarUrl || author.photoURL,
    };
  }

  return summary;
}

/**
 * Build participant summary for conversation views
 * @param {Object} participant - Participant object
 * @param {Object} user - User object
 * @returns {Object} Participant summary
 */
function buildParticipantSummary(participant, user) {
  return {
    id: participant.userId,
    nickname: user?.nickname || user?.displayName || 'Anonymous',
    avatarUrl: user?.avatarUrl || user?.photoURL || null,
    role: participant.role,
    joinedAt: participant.joinedAt,
    lastReadAt: participant.lastReadAt,
    isTyping: participant.isTyping || false,
    isBanned: participant.isBanned || false,
  };
}

/**
 * Build conversation metadata for admin/moderation views
 * @param {Object} conversation - Conversation object
 * @param {Array} participants - Array of participant objects
 * @param {Object} stats - Conversation statistics
 * @returns {Object} Conversation metadata
 */
function buildConversationMetadata(conversation, participants, stats = {}) {
  return {
    id: conversation.id,
    type: conversation.type,
    title: conversation.title,
    icon: conversation.icon,
    memberCount: participants.length,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    isLocked: conversation.isLocked || false,
    createdAt: conversation.createdAt,
    createdBy: conversation.createdBy,
    stats: {
      totalMessages: stats.totalMessages || 0,
      activeParticipants: stats.activeParticipants || 0,
      lastActivity: stats.lastActivity || conversation.lastMessageAt,
      ...stats,
    },
  };
}

/**
 * Build report summary for moderation views
 * @param {Object} report - Report object
 * @param {Object} reporter - Reporter user object
 * @param {Object} target - Target object (message, conversation, or user)
 * @returns {Object} Report summary
 */
function buildReportSummary(report, reporter, target) {
  const summary = {
    id: report.id,
    type: report.type,
    targetId: report.targetId,
    conversationId: report.conversationId,
    reasonCode: report.reasonCode,
    note: report.note,
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    reviewerId: report.reviewerId,
  };

  // Add reporter info (limited to avoid PII exposure)
  if (reporter) {
    summary.reporter = {
      id: reporter.uid,
      nickname: reporter.nickname || reporter.displayName || 'Anonymous',
    };
  }

  // Add target info based on type
  if (target) {
    switch (report.type) {
      case 'message':
        summary.target = {
          id: target.id,
          preview: buildMessagePreview(target.text, 50),
          authorId: target.authorId,
        };
        break;
      
      case 'conversation':
        summary.target = {
          id: target.id,
          title: target.title,
          type: target.type,
        };
        break;
      
      case 'user':
        summary.target = {
          id: target.uid,
          nickname: target.nickname || target.displayName || 'Anonymous',
        };
        break;
    }
  }

  return summary;
}

module.exports = {
  buildLastMessagePreview,
  buildConversationSummary,
  buildMessageSummary,
  buildParticipantSummary,
  buildConversationMetadata,
  buildReportSummary,
};
