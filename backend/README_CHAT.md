# Matcha Chat System

A comprehensive real-time chat system built with Node.js, Express, Firebase Firestore, and Socket.IO.

## Features

### Core Chat Functionality
- **Direct & Group Conversations**: Start private chats or create group conversations
- **Real-time Messaging**: Text, image, and audio message support
- **Message Reactions**: Emoji reactions on messages
- **Typing Indicators**: Show when users are typing
- **Presence System**: Track user online/offline status
- **Read Receipts**: Track message read status

### Safety & Moderation
- **User Blocking**: Block users to prevent unwanted interactions
- **Content Reporting**: Report inappropriate content for moderation
- **Admin Tools**: Comprehensive moderation tools for admins/moderators
- **Content Sanitization**: Strip HTML and sanitize user input
- **Rate Limiting**: Prevent abuse with granular rate limits

### Media Support
- **Image Uploads**: Support for JPEG, PNG, WebP (≤5MB)
- **Audio Messages**: Support for MP3, AAC, WebM (≤20MB)
- **Signed URLs**: Secure direct upload to Firebase Storage
- **Media Validation**: Server-side MIME type and size validation

## Architecture

### Data Model

#### Collections
- `conversations/{conversationId}` - Chat conversations
- `conversations/{conversationId}/participants/{userId}` - Conversation participants
- `messages/{messageId}` - Chat messages
- `messages/{messageId}/reactions/{userId}` - Message reactions
- `blocks/{blockId}` - User blocks (format: `{userId}_{blockedUserId}`)
- `chat_reports/{reportId}` - Content reports
- `presence/{userId}` - User presence status

#### Key Fields
```javascript
// Conversation
{
  id: string,
  type: 'direct' | 'group',
  title: string, // Only for groups
  icon: string, // Optional conversation icon
  members: string[], // User IDs
  memberCount: number,
  lastMessageAt: timestamp,
  lastMessagePreview: string,
  isLocked: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}

// Message
{
  id: string,
  conversationId: string,
  type: 'text' | 'image' | 'audio',
  text: string, // For text messages
  media: { // For media messages
    url: string,
    mime: string,
    size: number,
    width?: number, // For images
    height?: number, // For images
    durationMs?: number // For audio
  },
  authorId: string,
  authorNickname: string,
  replyToMessageId?: string,
  isDeleted: boolean,
  createdAt: timestamp,
  editedAt?: timestamp
}

// Participant
{
  userId: string,
  nickname: string,
  joinedAt: timestamp,
  lastReadAt: timestamp,
  isTyping: boolean,
  isMuted: boolean,
  role: 'member' | 'moderator' | 'owner'
}
```

### API Endpoints

#### Conversations
- `POST /api/v1/chat/conversations` - Create conversation
- `GET /api/v1/chat/conversations` - List user's conversations
- `GET /api/v1/chat/conversations/:id` - Get conversation details
- `POST /api/v1/chat/conversations/:id/join` - Join conversation
- `POST /api/v1/chat/conversations/:id/leave` - Leave conversation
- `PATCH /api/v1/chat/conversations/:id` - Update conversation
- `POST /api/v1/chat/conversations/:id/mute` - Toggle mute

#### Messages
- `POST /api/v1/chat/messages` - Send message
- `GET /api/v1/chat/messages/conversation/:conversationId` - Get messages
- `PATCH /api/v1/chat/messages/:id` - Edit message
- `DELETE /api/v1/chat/messages/:id` - Delete message
- `POST /api/v1/chat/messages/:id/reactions` - Add reaction
- `DELETE /api/v1/chat/messages/:id/reactions/:value` - Remove reaction

#### Presence & Typing
- `POST /api/v1/chat/presence/heartbeat` - Update presence
- `POST /api/v1/chat/conversations/:id/typing` - Set typing status
- `POST /api/v1/chat/conversations/:id/read` - Mark as read

#### Blocks
- `POST /api/v1/chat/blocks` - Block user
- `DELETE /api/v1/chat/blocks/:blockedUserId` - Unblock user
- `GET /api/v1/chat/blocks` - List blocked users

#### Reports
- `POST /api/v1/chat/reports` - Create report
- `GET /api/v1/chat/reports` - Get user's reports
- `GET /api/v1/chat/reports/:id` - Get specific report
- `PATCH /api/v1/chat/reports/:id/status` - Update report status

#### Storage
- `POST /api/v1/storage/chat/sign` - Generate media upload URL

#### Admin (Admin/Moderator only)
- `GET /api/v1/admin/chat/reports` - Get all reports
- `PATCH /api/v1/admin/chat/reports/:id/resolve` - Resolve report
- `DELETE /api/v1/admin/chat/messages/:id` - Remove message
- `POST /api/v1/admin/chat/conversations/:id/ban/:userId` - Ban user
- `POST /api/v1/admin/chat/conversations/:id/lock` - Lock conversation

### Security Rules

Firestore security rules enforce:
- **Authentication**: All operations require valid Firebase ID token
- **Participation**: Users can only access conversations they're part of
- **Ownership**: Message authors can edit/delete their own messages
- **Moderation**: Admins/moderators have elevated permissions
- **Blocking**: Blocked users cannot send messages to blockers
- **Locked Conversations**: No new messages in locked conversations

### Rate Limiting

Granular rate limits prevent abuse:
- **Send Message**: 10 per minute, 100 per hour per user
- **Create Conversation**: 5 per hour per user
- **Typing/Presence**: 30 per minute per user
- **Reports**: 5 per hour per user
- **Blocks**: 10 per hour per user
- **Storage Signing**: 20 per hour per user

## Setup & Configuration

### Environment Variables
```bash
# Chat Features
ENABLE_CHAT_AUDIO=true
ENABLE_CHAT_REALTIME_WS=true
ENABLE_CHAT_TYPING=true
ENABLE_CHAT_PRESENCE=true
ENABLE_CHAT_MODERATION=true
ENABLE_CHAT_PUSH=false

# Firebase
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
FIREBASE_PROJECT_ID=your-project-id

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000
```

### Dependencies
```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "sanitize-html": "^2.12.1",
    "socket.io": "^4.7.4"
  }
}
```

### Firebase Setup
1. Create Firebase project
2. Enable Firestore Database
3. Enable Firebase Storage
4. Set up Authentication (Email/Password, Google, etc.)
5. Deploy security rules: `npm run deploy:rules`

## Usage Examples

### Starting the Server
```bash
# Development
npm run dev

# Production
npm start

# With Firebase emulators
npm run emulators
```

### WebSocket Connection
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:8080', {
  auth: {
    token: 'firebase-id-token'
  }
});

// Join conversations
socket.emit('join_conversations', ['conversation1', 'conversation2']);

// Listen for messages
socket.on('new_message', (message) => {
  console.log('New message:', message);
});

// Typing indicators
socket.on('typing_start', (data) => {
  console.log(`${data.userId} is typing...`);
});
```

### API Client Example
```javascript
const API_BASE = 'http://localhost:8080/api/v1';

// Create conversation
const createConversation = async (type, members) => {
  const response = await fetch(`${API_BASE}/chat/conversations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type,
      memberUserIds: members
    })
  });
  return response.json();
};

// Send message
const sendMessage = async (conversationId, text) => {
  const response = await fetch(`${API_BASE}/chat/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      conversationId,
      type: 'text',
      text
    })
  });
  return response.json();
};
```

## Testing

### Run Tests
```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Test Structure
- **Unit Tests**: Individual service functions
- **Integration Tests**: API endpoints with mocked Firebase
- **E2E Tests**: Full chat flow testing

## Performance Considerations

### Firestore Optimization
- **Single-field Indexes**: Used for basic queries
- **Collection Groups**: For reactions and participants
- **Denormalization**: Store frequently accessed data (nicknames, previews)
- **Pagination**: Cursor-based pagination for large datasets

### Rate Limiting
- **Per-User Limits**: Prevent individual user abuse
- **Per-IP Limits**: Prevent coordinated attacks
- **Daily Limits**: Prevent long-term abuse

### Caching Strategy
- **Presence Cache**: Redis for real-time presence (future enhancement)
- **User Cache**: Cache user profiles to reduce Firestore reads
- **Conversation Cache**: Cache active conversation metadata

## Monitoring & Logging

### Logging
- **Structured Logging**: Pino for performance
- **Request Logging**: All API requests logged with user context
- **Error Logging**: Detailed error logs with stack traces
- **Audit Logging**: Track all moderation actions

### Metrics
- **Message Volume**: Track messages per conversation
- **User Activity**: Monitor user engagement
- **Error Rates**: Track API error frequencies
- **Response Times**: Monitor API performance

## Security Features

### Input Validation
- **Schema Validation**: Express-validator for all inputs
- **Content Sanitization**: Strip HTML, allow safe formatting
- **File Validation**: MIME type and size validation
- **Rate Limiting**: Prevent brute force attacks

### Authentication & Authorization
- **Firebase Auth**: Secure token-based authentication
- **Role-based Access**: Admin, moderator, and user roles
- **Permission Checks**: Granular permission validation
- **Block Lists**: Prevent unwanted interactions

### Data Protection
- **PII Filtering**: Remove sensitive data from responses
- **Audit Trails**: Track all data modifications
- **Soft Deletes**: Preserve data for moderation
- **Encryption**: Firebase handles data encryption

## Deployment

### Production Checklist
- [ ] Set production environment variables
- [ ] Deploy Firestore security rules
- [ ] Configure Firebase Storage rules
- [ ] Set up monitoring and alerting
- [ ] Configure CORS for production domain
- [ ] Set up SSL/TLS certificates
- [ ] Configure rate limiting for production load

### Scaling Considerations
- **Horizontal Scaling**: Multiple server instances
- **Load Balancing**: Distribute WebSocket connections
- **Database Sharding**: Partition conversations by user
- **CDN**: Cache static assets and media

## Troubleshooting

### Common Issues

#### Firebase Initialization Error
```
Error: The default Firebase app does not exist
```
**Solution**: Ensure Firebase is initialized before importing modules that use Firebase services.

#### Port Already in Use
```
Error: EADDRINUSE: address already in use :::8080
```
**Solution**: Kill the process using the port or change the port in configuration.

#### Rate Limit Exceeded
```
Error: Too many requests
```
**Solution**: Implement exponential backoff in client applications.

#### WebSocket Connection Failed
```
Error: Authentication failed
```
**Solution**: Ensure valid Firebase ID token is passed in WebSocket auth.

### Debug Mode
```bash
# Enable debug logging
DEBUG=chat:* npm run dev

# View Firestore rules
firebase firestore:rules:get

# Check indexes
firebase firestore:indexes
```

## Contributing

### Development Workflow
1. Create feature branch
2. Implement changes with tests
3. Run linting: `npm run lint:fix`
4. Run tests: `npm test`
5. Submit pull request

### Code Standards
- **ESLint**: Follow project linting rules
- **Prettier**: Consistent code formatting
- **JSDoc**: Document public functions
- **Tests**: Maintain >80% test coverage

## License

MIT License - see LICENSE file for details.

## Support

For questions or issues:
1. Check the troubleshooting section
2. Review Firestore security rules
3. Check server logs for errors
4. Open an issue with detailed error information
