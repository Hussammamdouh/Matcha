# Chat System Test Suite

This directory contains comprehensive tests for the Matcha Chat system, covering all major functionality including conversations, messages, reactions, presence, typing indicators, user blocking, content reporting, admin moderation, and WebSocket functionality.

## Test Structure

### Core Chat Functionality Tests

#### `chat.conversations.test.js`
Tests for conversation management:
- **Conversation Creation**: Direct and group conversations
- **Conversation Retrieval**: Getting conversation details and listing conversations
- **Conversation Management**: Joining, leaving, updating, and muting
- **Authorization**: Participant checks and role-based access control
- **Validation**: Input validation and error handling
- **Rate Limiting**: Anti-abuse protection

#### `chat.messages.test.js`
Tests for message operations:
- **Message Sending**: Text and media messages
- **Message Retrieval**: Pagination and filtering
- **Message Editing**: Content updates within time window
- **Message Deletion**: Soft deletion with proper authorization
- **Message Reactions**: Adding and removing reactions
- **Validation**: Content sanitization and length limits
- **Permissions**: Author and participant checks

#### `chat.blocks.test.js`
Tests for user blocking functionality:
- **Block Management**: Blocking and unblocking users
- **Block Lists**: Retrieving blocked users with pagination
- **Validation**: Self-blocking prevention and duplicate checks
- **Authorization**: User-specific block management
- **Rate Limiting**: Anti-abuse protection for block operations

#### `chat.reports.test.js`
Tests for content reporting system:
- **Report Creation**: Message, conversation, and user reports
- **Report Management**: Status updates and resolution
- **Report Retrieval**: Filtering and pagination
- **Validation**: Report type and reason validation
- **Workflow**: Status progression and audit trail
- **Authorization**: Reporter and moderator permissions

#### `chat.presence.test.js`
Tests for presence and typing indicators:
- **Presence Updates**: Online/offline status management
- **Typing Indicators**: Real-time typing status broadcasting
- **Read Receipts**: Message read status tracking
- **Validation**: State validation and timestamp handling
- **Rate Limiting**: Presence update frequency control
- **Integration**: Cross-feature presence coordination

#### `chat.reactions.test.js`
Tests for message reaction system:
- **Reaction Management**: Adding and removing reactions
- **Reaction Retrieval**: Listing reactions with user details
- **Validation**: Reaction value and uniqueness checks
- **Permissions**: Participant-based reaction access
- **Performance**: Efficient reaction aggregation
- **Integration**: Message-reaction relationship management

#### `chat.storage.test.js`
Tests for media storage functionality:
- **Upload URLs**: Signed URL generation for media uploads
- **Media Validation**: File type, size, and format validation
- **Authorization**: Participant-based upload permissions
- **Security**: Path traversal prevention and access control
- **Feature Flags**: Audio upload enable/disable
- **Integration**: Storage-chat system coordination

#### `chat.admin.test.js`
Tests for admin and moderation tools:
- **Report Management**: Admin review and resolution workflows
- **Content Moderation**: Message deletion and conversation locking
- **User Management**: Role-based access control
- **Audit Trail**: Moderation action logging
- **Authorization**: Admin and moderator permission levels
- **Workflow**: End-to-end moderation processes

#### `chat.websocket.test.js`
Tests for real-time WebSocket functionality:
- **Connection Management**: Authentication and connection handling
- **Room Management**: Joining and leaving conversation rooms
- **Real-time Events**: Typing indicators, presence updates, message broadcasting
- **Error Handling**: Connection failures and malformed data
- **Performance**: Concurrent connections and room switching
- **Security**: Authentication and authorization validation

#### `run-all.test.js`
Integration tests covering complete workflows:
- **End-to-End Workflows**: Complete conversation lifecycles
- **Cross-Feature Integration**: Multiple chat features working together
- **Performance Testing**: Load handling and efficiency
- **Error Scenarios**: Network failures and edge cases
- **Concurrent Operations**: Multiple simultaneous actions
- **Data Consistency**: Transaction integrity and state management

## Test Coverage

### API Endpoints Covered
- `POST /api/v1/chat/conversations` - Create conversations
- `GET /api/v1/chat/conversations` - List conversations
- `GET /api/v1/chat/conversations/:id` - Get conversation details
- `POST /api/v1/chat/conversations/:id/join` - Join conversation
- `POST /api/v1/chat/conversations/:id/leave` - Leave conversation
- `PATCH /api/v1/chat/conversations/:id` - Update conversation
- `POST /api/v1/chat/conversations/:id/mute` - Toggle mute
- `POST /api/v1/chat/conversations/:id/read` - Mark as read
- `POST /api/v1/chat/messages` - Send messages
- `GET /api/v1/chat/messages/conversation/:id` - Get messages
- `PATCH /api/v1/chat/messages/:id` - Edit messages
- `DELETE /api/v1/chat/messages/:id` - Delete messages
- `POST /api/v1/chat/messages/:id/reactions` - Add reactions
- `DELETE /api/v1/chat/messages/:id/reactions/:value` - Remove reactions
- `GET /api/v1/chat/messages/:id/reactions` - Get reactions
- `POST /api/v1/chat/blocks` - Block users
- `DELETE /api/v1/chat/blocks/:id` - Unblock users
- `GET /api/v1/chat/blocks` - List blocked users
- `POST /api/v1/chat/reports` - Create reports
- `GET /api/v1/chat/reports` - List reports
- `GET /api/v1/chat/reports/:id` - Get report details
- `PATCH /api/v1/chat/reports/:id/status` - Update report status
- `POST /api/v1/chat/presence/heartbeat` - Update presence
- `POST /api/v1/chat/conversations/:id/typing` - Set typing status
- `POST /api/v1/storage/chat/sign` - Generate upload URLs
- `GET /api/v1/admin/chat/reports` - Admin report management
- `PATCH /api/v1/admin/chat/reports/:id/status` - Admin report resolution
- `DELETE /api/v1/admin/chat/messages/:id` - Admin message deletion
- `POST /api/v1/admin/chat/conversations/:id/lock` - Admin conversation locking

### WebSocket Events Covered
- `connect` - Connection establishment
- `join_conversation` - Join conversation room
- `leave_conversation` - Leave conversation room
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator
- `presence_update` - Update user presence
- `new_message` - Broadcast new message
- `message_edited` - Broadcast edited message
- `message_deleted` - Broadcast deleted message

## Test Categories

### Unit Tests
- Individual function testing
- Mock data validation
- Error handling verification
- Input validation testing

### Integration Tests
- API endpoint testing
- Service layer integration
- Database operation testing
- Cross-feature coordination

### End-to-End Tests
- Complete workflow testing
- Real-world scenario simulation
- Performance and load testing
- Error scenario handling

### Security Tests
- Authentication verification
- Authorization checks
- Input sanitization
- Access control validation

## Running Tests

### Individual Test Files
```bash
# Run specific test file
npm test -- chat.conversations.test.js

# Run with coverage
npm test -- --coverage chat.messages.test.js
```

### All Chat Tests
```bash
# Run all chat tests
npm run test:chat

# Run with coverage
npm run test:chat -- --coverage
```

### Test Categories
```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run all tests
npm test
```

## Test Configuration

### Jest Configuration
- **Test Environment**: Node.js
- **Test Framework**: Jest + Supertest
- **Mocking**: Firebase Admin SDK, external dependencies
- **Coverage**: Istanbul coverage reports
- **Timeout**: 30 seconds per test

### Mock Setup
- **Firebase Admin**: Auth, Firestore, Storage
- **External Services**: Rate limiters, sanitizers
- **Database**: Firestore operations and transactions
- **Authentication**: JWT token validation

### Test Data
- **Mock Users**: Various user roles and permissions
- **Mock Conversations**: Direct and group conversations
- **Mock Messages**: Text and media messages
- **Mock Reactions**: Various reaction types
- **Mock Reports**: Different report scenarios

## Best Practices

### Test Organization
- **Descriptive Names**: Clear test case descriptions
- **Logical Grouping**: Related tests in describe blocks
- **Setup/Teardown**: Proper beforeEach/afterEach usage
- **Mock Management**: Consistent mock setup and cleanup

### Test Quality
- **Comprehensive Coverage**: All code paths tested
- **Edge Cases**: Boundary conditions and error scenarios
- **Performance**: Response time and resource usage
- **Security**: Authentication and authorization validation

### Maintainability
- **DRY Principle**: Reusable test utilities
- **Clear Assertions**: Specific and meaningful expectations
- **Mock Consistency**: Standardized mock patterns
- **Documentation**: Clear test purpose and setup

## Continuous Integration

### Automated Testing
- **Pre-commit Hooks**: Lint and test before commit
- **CI Pipeline**: Automated test execution
- **Coverage Reports**: Minimum coverage thresholds
- **Performance Monitoring**: Response time tracking

### Quality Gates
- **Test Coverage**: Minimum 90% coverage required
- **Test Passing**: All tests must pass
- **Performance**: Response time within acceptable limits
- **Security**: No security vulnerabilities detected

## Troubleshooting

### Common Issues
- **Mock Setup**: Ensure proper mock configuration
- **Async Testing**: Use proper async/await patterns
- **Database State**: Clean up test data between tests
- **Timeout Issues**: Increase Jest timeout for complex tests

### Debug Mode
```bash
# Run tests in debug mode
npm test -- --verbose --detectOpenHandles

# Run specific test with debugging
npm test -- --runInBand --verbose chat.conversations.test.js
```

### Performance Issues
- **Mock Optimization**: Reduce unnecessary mock operations
- **Test Isolation**: Ensure tests don't interfere with each other
- **Resource Cleanup**: Proper cleanup of test resources
- **Parallel Execution**: Use Jest's parallel test execution

## Contributing

### Adding New Tests
1. **Follow Naming Convention**: `feature.functionality.test.js`
2. **Use Existing Patterns**: Follow established test structure
3. **Comprehensive Coverage**: Test all code paths and edge cases
4. **Documentation**: Add clear test descriptions and setup notes

### Test Maintenance
1. **Regular Updates**: Keep tests current with code changes
2. **Mock Updates**: Update mocks when dependencies change
3. **Coverage Monitoring**: Track and improve test coverage
4. **Performance Monitoring**: Ensure tests remain fast and efficient

## Resources

### Documentation
- [Jest Testing Framework](https://jestjs.io/)
- [Supertest HTTP Testing](https://github.com/visionmedia/supertest)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin)
- [Express.js Testing](https://expressjs.com/en/advanced/best-practices-performance.html)

### Related Files
- `setup.js` - Global test configuration
- `package.json` - Test scripts and dependencies
- `jest.config.js` - Jest configuration
- `firestore.rules` - Database security rules
- `swagger.js` - API documentation

### Support
- **Issues**: Report test failures and bugs
- **Discussions**: Ask questions about test implementation
- **Contributions**: Submit improvements and new tests
- **Documentation**: Help improve test documentation
