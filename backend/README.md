# Matcha Backend

A production-ready, hardened backend for the Matcha women-only anonymous social application. Built with Node.js, Express, Firebase Admin, and designed for scalability without composite indexes.

## 🚀 Features

- **Authentication**: Firebase Auth with ID token verification
- **Database**: Firestore with optimized single-field indexes
- **Storage**: Firebase Storage with secure access rules
- **Real-time**: WebSocket support for chat and presence
- **Moderation**: Comprehensive RBAC and content moderation
- **Security**: Rate limiting, input validation, and sanitization
- **Observability**: Structured logging, metrics, and health checks
- **Scalability**: Transaction-based counters and rankings

## 🏗️ Architecture

### Core Modules
- **Auth**: User authentication and session management
- **Users**: User profiles and management
- **Communities**: Community creation and moderation
- **Posts**: Content creation with voting and comments
- **Chat**: Direct and group messaging
- **Men-Review**: Photo review system with safety checks
- **Admin**: Moderation tools and system administration
- **Storage**: File upload and management

### Security Features
- **RBAC**: Role-based access control (User, Moderator, Admin, Super Admin)
- **Rate Limiting**: Per-route and daily quota limits
- **Input Validation**: Express-validator with sanitization
- **Idempotency**: Safe retry for destructive admin actions
- **Server-Only Fields**: Protected counters and moderation flags

## 🚦 Feature Flags

| Feature | Development | Staging | Production | Description |
|---------|-------------|---------|------------|-------------|
| `kyc` | ❌ | ❌ | ❌ | KYC verification system |
| `sms` | ❌ | ❌ | ❌ | SMS verification |
| `recaptcha` | ❌ | ❌ | ❌ | reCAPTCHA integration |
| `shadowban` | ✅ | ✅ | ✅ | Shadowban filtering |
| `advanced_moderation` | ✅ | ✅ | ✅ | Enhanced moderation tools |
| `analytics` | ✅ | ✅ | ✅ | User analytics and metrics |

## 📊 Rate Limits

### General Limits
- **General**: 1000 requests per 15 minutes
- **Authentication**: 5 attempts per 15 minutes

### Content Creation
- **Posts**: 10 per hour, 50 per day
- **Comments**: 20 per 15 minutes, 200 per day
- **Votes**: 50 per 5 minutes, 500 per day
- **Chat Messages**: 30 per minute, 1000 per day
- **Men Reviews**: 5 per hour, 20 per day

### Admin Actions
- **Moderation**: 10 actions per minute
- **Reports**: 3 per hour
- **User Management**: 10 actions per minute

## 🛠️ Quick Start

### Prerequisites
- Node.js 20+
- Firebase project
- Redis (optional, for distributed rate limiting)

### Local Development

1. **Clone and install dependencies**
   ```bash
   git clone <repository>
   cd backend
   npm install
   ```

2. **Environment setup**
   ```bash
   cp env.example .env
   # Edit .env with your Firebase credentials
   ```

3. **Firebase emulators**
   ```bash
   npm run emulators
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Run tests**
   ```bash
   npm test
   npm run test:coverage
   ```

### Firebase Emulator Setup

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Start emulators**
   ```bash
   firebase emulators:start --only auth,firestore,storage
   ```

4. **Deploy rules to emulator**
   ```bash
   firebase deploy --only firestore:rules,storage --project <project-id>
   ```

## 🔒 Security Rules Deployment

### Firestore Rules
```bash
# Deploy to production
firebase deploy --only firestore:rules --project <project-id>

# Deploy to staging
firebase deploy --only firestore:rules --project <staging-project-id>
```

### Storage Rules
```bash
# Deploy to production
firebase deploy --only storage --project <project-id>

# Deploy to staging
firebase deploy --only storage --project <staging-project-id>
```

### Rules Validation
```bash
# Validate rules locally
firebase emulators:start --only firestore,storage
firebase deploy --only firestore:rules,storage --project <project-id>
```

## 🚀 Production Deployment

### Environment Variables
```bash
# Required
NODE_ENV=production
PORT=8080
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_STORAGE_BUCKET=your-bucket

# Optional
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
CORS_ORIGINS=https://yourdomain.com
```

### Docker Deployment
```bash
# Build image
npm run docker:build

# Run container
npm run docker:run

# Deploy to Cloud Run
gcloud run deploy matcha-backend \
  --image gcr.io/your-project/matcha-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Fly.io Deployment
```bash
# Deploy
npm run fly:deploy

# Set secrets
npm run fly:secrets

# View logs
npm run fly:logs
```

## 📈 Monitoring & Health Checks

### Health Endpoints
- **`/healthz`**: Basic server health (always 200)
- **`/readyz`**: Service readiness (checks dependencies)
- **`/metrics`**: Prometheus metrics
- **`/healthz/detailed`**: Comprehensive system status

### Logging
- **Structured logging** with Pino
- **Sensitive data redaction** (tokens, IPs, emails)
- **Request correlation** with unique IDs
- **Performance metrics** and error tracking

### Metrics
- **Application metrics**: Uptime, memory usage
- **Business metrics**: User activity, content creation
- **Performance metrics**: Response times, error rates
- **Security metrics**: Rate limit violations, auth failures

## 🧪 Testing

### Test Structure
```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── chat/          # Chat-specific tests
└── fixtures/      # Test data and mocks
```

### Running Tests
```bash
# All tests
npm test

# Specific test suites
npm run test:chat
npm run test:unit
npm run test:integration

# Coverage report
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Database
- **Firebase Emulator**: Local development and testing
- **Test Data**: Seeded with realistic scenarios
- **Cleanup**: Automatic cleanup between test runs

## 🔧 Configuration

### Environment Configuration
```javascript
// config/index.js
module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 8080,
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  },
  redis: {
    enabled: process.env.REDIS_URL ? true : false,
    url: process.env.REDIS_URL
  },
  features: {
    kyc: process.env.FEATURE_KYC === 'true',
    sms: process.env.FEATURE_SMS === 'true',
    recaptcha: process.env.FEATURE_RECAPTCHA === 'true'
  }
};
```

### Feature Flags
```javascript
// Enable/disable features via environment
FEATURE_KYC=false
FEATURE_SMS=false
FEATURE_RECAPTCHA=false
FEATURE_SHADOWBAN=true
FEATURE_ADVANCED_MODERATION=true
```

## 📚 API Documentation

### OpenAPI/Swagger
- **Development**: Available at `/docs`
- **Production**: Protected with basic auth
- **Export**: Postman collection available

### API Versioning
- **Current**: `/api/v1/`
- **Deprecation**: 6-month notice for breaking changes
- **Migration**: Backward compatibility maintained

## 🚨 Incident Response

### Common Issues
1. **Rate Limit Exceeded**: Check user activity patterns
2. **Firestore Quota**: Monitor read/write operations
3. **Storage Quota**: Review file upload patterns
4. **Memory Leaks**: Check for unclosed connections

### Emergency Procedures
1. **Service Degradation**: Enable rate limiting
2. **Security Breach**: Rotate API keys, audit logs
3. **Data Loss**: Restore from backups
4. **Performance Issues**: Scale horizontally

### Contact Information
- **On-call**: [Team contact info]
- **Escalation**: [Manager contact info]
- **Documentation**: [Runbook links]

## 🤝 Contributing

### Development Workflow
1. **Feature branch**: `feature/description`
2. **Bug fix**: `fix/description`
3. **Hotfix**: `hotfix/description`

### Code Standards
- **ESLint**: Code quality and style
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks
- **Tests**: Required for all changes

### Review Process
1. **Self-review**: Test locally
2. **Peer review**: Code review required
3. **Integration tests**: Must pass
4. **Deployment**: Staging first, then production

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Firebase team for excellent tooling
- Express.js community for the robust framework
- Open source contributors for security libraries

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Maintainer**: Matcha Backend Team
