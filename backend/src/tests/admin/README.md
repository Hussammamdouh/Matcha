# Admin System Test Suite

This directory contains comprehensive tests for the Matcha Admin & Safety system, covering RBAC, moderation queues, user management, feature flags, content exports, and audit logging.

## Test Structure

### Core Test Files

- **`rbac.test.js`** - Role-Based Access Control tests
  - Admin vs moderator permissions
  - Role transition validation
  - Permission matrix enforcement
  - Authentication and authorization

- **`reports.test.js`** - Reports queue management tests
  - Unified reports across surfaces (feed, chat, men)
  - Report claiming, resolution, and dismissal
  - Bulk operations
  - Status transitions and workflows

- **`users.test.js`** - User management tests
  - Role assignment and management
  - User banning/unbanning
  - Shadowban management
  - Session control (logout all)
  - User search and details

- **`features-exports.test.js`** - Feature flags and exports tests
  - Feature flag management (admin only)
  - Safe feature validation
  - Content export job creation
  - Export job status tracking
  - Export options and workflows

- **`audits.test.js`** - Audit logging tests
  - Audit log creation and retrieval
  - Filtering and pagination
  - Security and data sanitization
  - Integration with admin actions

- **`run-all.test.js`** - Integration and workflow tests
  - Complete admin workflows
  - Cross-feature integration
  - Error handling and edge cases
  - Performance and scalability

## Test Coverage

### API Endpoints Covered

#### Reports Management
- `GET /api/v1/admin/reports` - Unified reports with filtering
- `POST /api/v1/admin/reports/:id/claim` - Claim report for review
- `POST /api/v1/admin/reports/:id/resolve` - Resolve report
- `POST /api/v1/admin/reports/:id/dismiss` - Dismiss report
- `POST /api/v1/admin/reports/bulk/resolve` - Bulk resolve reports
- `POST /api/v1/admin/reports/bulk/dismiss` - Bulk dismiss reports

#### User Management
- `POST /api/v1/admin/users/:uid/role` - Set user role (admin only)
- `POST /api/v1/admin/users/:uid/ban` - Ban user
- `POST /api/v1/admin/users/:uid/unban` - Unban user
- `POST /api/v1/admin/users/:uid/shadowban` - Shadowban user
- `POST /api/v1/admin/users/:uid/unshadowban` - Remove shadowban
- `POST /api/v1/admin/users/:uid/logout-all` - Logout all sessions (admin only)
- `GET /api/v1/admin/users/search` - Search users
- `GET /api/v1/admin/users/:uid` - Get user details

#### Feature Flags
- `GET /api/v1/admin/system/features` - Get feature flags (admin only)
- `PATCH /api/v1/admin/system/features` - Update feature flags (admin only)

#### Content Exports
- `POST /api/v1/admin/export/users/:uid` - Create export job
- `GET /api/v1/admin/export/jobs/:jobId` - Get export job status

#### Audit Logs
- `GET /api/v1/admin/audits` - Get audit logs with filtering

### Test Categories

#### Unit Tests
- Individual endpoint functionality
- Input validation
- Error handling
- Response formatting

#### Integration Tests
- Cross-endpoint workflows
- Data consistency
- Service interactions
- Transaction handling

#### Security Tests
- RBAC enforcement
- Permission validation
- Authentication requirements
- Data sanitization

#### Workflow Tests
- Complete admin processes
- Multi-step operations
- State transitions
- Audit trail verification

## Running the Tests

### Prerequisites
- Node.js 20+
- Jest testing framework
- Firebase emulator (for integration tests)
- Mock data setup

### Test Commands

```bash
# Run all admin tests
npm run test:admin

# Run specific test categories
npm run test:admin:rbac
npm run test:admin:reports
npm run test:admin:users
npm run test:admin:features
npm run test:admin:audits

# Run with coverage
npm run test:admin:coverage

# Run integration tests only
npm run test:admin:integration
```

### Test Configuration

The tests use the following configuration:

- **Environment**: Test environment with mocked Firebase services
- **Database**: Firebase emulator (when available)
- **Authentication**: Mock JWT tokens with role claims
- **Rate Limiting**: Disabled for testing
- **Logging**: Minimal output for test clarity

## Mock Data

### User Types

- **Admin User**: Full permissions, can manage roles and features
- **Moderator User**: Limited permissions, can moderate content and users
- **Regular User**: No admin permissions

### Test Data

- Mock users with different roles
- Sample reports across surfaces
- Test content for moderation
- Feature flag configurations
- Export job scenarios

## Test Patterns

### Authentication Testing
```javascript
it('should require authentication', async () => {
  await request(app)
    .get('/api/v1/admin/reports')
    .expect(401);
});
```

### Role-Based Testing
```javascript
it('should allow admin but deny moderator', async () => {
  // Admin should succeed
  const adminResponse = await request(app)
    .post('/api/v1/admin/users/test-id/role')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ role: 'moderator' })
    .expect(200);

  // Moderator should fail
  const moderatorResponse = await request(app)
    .post('/api/v1/admin/users/test-id/role')
    .set('Authorization', `Bearer ${moderatorToken}`)
    .send({ role: 'admin' })
    .expect(403);
});
```

### Workflow Testing
```javascript
it('should handle complete workflow', async () => {
  // Step 1: Initial action
  const step1 = await request(app)
    .post('/api/v1/admin/reports/test-id/claim')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ surface: 'feed' })
    .expect(200);

  // Step 2: Follow-up action
  const step2 = await request(app)
    .post('/api/v1/admin/reports/test-id/resolve')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ 
      surface: 'feed',
      resolutionCode: 'removed_content'
    })
    .expect(200);

  // Step 3: Verify final state
  const verification = await request(app)
    .get('/api/v1/admin/reports?status=resolved')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  expect(verification.body.data).toBeDefined();
});
```

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Keep tests independent and isolated

### Mock Management
- Use consistent mock data
- Reset mocks between tests
- Avoid hardcoded test values
- Use factory functions for test data

### Error Testing
- Test both success and failure cases
- Verify error codes and messages
- Test edge cases and invalid inputs
- Ensure proper HTTP status codes

### Integration Testing
- Test complete workflows
- Verify data consistency
- Check audit trail creation
- Test cross-service interactions

## Coverage Goals

### Target Coverage: ≥80%

- **RBAC**: 100% - All permission checks and role validations
- **Reports**: 95% - Core functionality and edge cases
- **Users**: 90% - User management operations
- **Features**: 85% - Feature flag management
- **Exports**: 80% - Export job lifecycle
- **Audits**: 90% - Audit logging and retrieval

### Coverage Areas

- **Lines**: All executable code paths
- **Functions**: All exported functions
- **Branches**: Conditional logic and error paths
- **Statements**: Complete statement execution

## Troubleshooting

### Common Issues

1. **Firebase Emulator Not Running**
   - Start Firebase emulator before running tests
   - Check emulator configuration

2. **Mock Data Issues**
   - Verify mock setup in test files
   - Check mock function implementations
   - Ensure proper cleanup between tests

3. **Authentication Failures**
   - Verify JWT token mocking
   - Check role claim structure
   - Ensure middleware is properly mocked

4. **Database Connection Issues**
   - Check emulator connection settings
   - Verify test environment variables
   - Ensure proper test isolation

### Debug Mode

Run tests with debug output:

```bash
# Enable Jest debug mode
DEBUG=* npm run test:admin

# Run specific test with verbose output
npm run test:admin -- --verbose --no-coverage
```

## Contributing

### Adding New Tests

1. **Follow existing patterns** - Use established test structure
2. **Test both success and failure** - Cover all code paths
3. **Use descriptive names** - Clear test purpose and expectations
4. **Maintain isolation** - Tests should not depend on each other
5. **Add to appropriate category** - Group related functionality

### Test Maintenance

- Update tests when API changes
- Maintain mock data consistency
- Keep test data realistic
- Regular coverage review
- Performance monitoring

## Resources

### Documentation
- [Jest Testing Framework](https://jestjs.io/)
- [Supertest HTTP Testing](https://github.com/visionmedia/supertest)
- [Firebase Emulator](https://firebase.google.com/docs/emulator-suite)
- [Express Testing Best Practices](https://expressjs.com/en/advanced/best-practices-performance.html)

### Related Files
- `src/modules/admin/` - Admin module implementation
- `src/middlewares/auth.js` - Authentication middleware
- `src/lib/logger.js` - Logging utilities
- `firestore.rules` - Database security rules
- `firestore.indexes.json` - Database indexes

### Test Utilities
- `src/tests/setup.js` - Global test setup
- `src/tests/mocks/` - Mock implementations
- `src/tests/helpers/` - Test helper functions
- `src/tests/fixtures/` - Test data fixtures
