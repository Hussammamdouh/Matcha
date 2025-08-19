# Matcha Backend

A secure, scalable backend for Matcha - a women-only anonymous social application built with Node.js, Express, and Firebase.

## 🚀 Features

- **Authentication & Authorization**
  - **Firebase-only authentication** - Clients authenticate directly with Firebase SDK
  - **Secure ID token verification** - Backend verifies Firebase ID tokens
  - **Email verification & password reset** - Uses Firebase Admin for secure links
  - **Google/Apple OAuth** - Social authentication support
  - **Multi-factor authentication (MFA)** - TOTP only (SMS disabled)
  - **Role-based access control** - Admin, moderator, user roles
  - **Session and device management** - Track and manage user sessions

- **Security & Privacy**
  - **Rate limiting** - Stricter limits on auth endpoints
  - **Comprehensive audit logging** - All sensitive operations tracked
  - **Helmet security headers** - Protection against common vulnerabilities
  - **CORS protection** - Origin allowlisting
  - **Firestore security rules** - User data isolation
  - **Storage security rules** - Avatar upload restrictions

## 🔧 Feature Flags

The backend uses feature flags to control optional functionality:

```env
# Feature Flags
ENABLE_KYC=false              # KYC verification system
ENABLE_PHONE_AUTH=false       # Phone OTP + SMS MFA
ENABLE_RECAPTCHA=false        # reCAPTCHA Enterprise
```

**Current Status:**
- ✅ **Email/Password Authentication** - Always enabled
- ✅ **Google/Apple OAuth** - Always enabled  
- ✅ **TOTP MFA** - Always enabled
- ❌ **SMS/Phone OTP** - Disabled by default
- ❌ **KYC Verification** - Disabled by default
- ❌ **reCAPTCHA** - Disabled by default

To enable any feature, set the corresponding environment variable to `true`.

- **Scalability**
  - Cloud Run deployment with auto-scaling
  - Firestore for data storage
  - Cloud Tasks for async operations
  - Cloud Scheduler for cron jobs

## 🏗️ Architecture

```
src/
├── config/          # Configuration management (including feature flags)
├── lib/             # Core libraries (Firebase, etc.)
├── middlewares/     # Express middlewares
├── modules/         # Feature modules
│   ├── auth/        # Authentication endpoints (email/password, OAuth)
│   ├── users/       # User profile management
│   ├── devices/     # Device management
│   ├── sessions/    # Session management
│   ├── admin/       # Administrative functions (feature-flagged)
│   └── audit/       # Audit logging
├── routes/          # Health check routes
├── webhooks/        # External service webhooks (feature-flagged)
├── jobs/            # Cloud Tasks handlers
└── docs/            # API documentation
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Authentication**: Firebase Admin SDK
- **Database**: Firestore (Native mode)
- **Storage**: Firebase Storage (GCS)
- **Deployment**: Google Cloud Run
- **Security**: Cloud KMS, reCAPTCHA Enterprise
- **Monitoring**: Cloud Logging, Cloud Trace

## 📋 Prerequisites

- Node.js 20+ installed
- Google Cloud Platform account
- Firebase project created
- Service account key with appropriate permissions

## 🔐 Authentication Flow

**Important: This backend does NOT handle raw passwords. All authentication is done via Firebase.**

### Client Authentication Flow:
1. **Client authenticates** with Firebase SDK (email/password, Google, Apple)
2. **Client gets ID token** from Firebase Auth
3. **Client sends ID token** in `Authorization: Bearer <idToken>` header
4. **Backend verifies token** using Firebase Admin SDK
5. **Backend grants access** to protected endpoints

### Backend Authentication:
- **No password storage** - Firebase handles all password operations
- **ID token verification** - Every request validates Firebase ID token
- **Email verification** - Uses Firebase Admin `generateEmailVerificationLink`
- **Password reset** - Uses Firebase Admin `generatePasswordResetLink`
- **Secure by design** - No sensitive data sent to backend

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd backend
npm install
```

### 2. Environment Setup

Copy the environment template and configure your values:

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```env
NODE_ENV=development
PORT=8080
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

### 3. Firebase Setup

1. Download your Firebase service account key
2. Place it in the project root as `service-account-key.json`
3. Enable Firestore and Storage in your Firebase project

### 4. Start Development Server

```bash
npm run dev
```

The server will start at `http://localhost:8080`

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | `development` |
| `PORT` | Server port | `8080` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | Required |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account key path | Required |
| `ALLOW_ORIGINS` | CORS allowed origins | `http://localhost:3000` |
| `RECAPTCHA_ENTERPRISE_API_KEY` | reCAPTCHA API key | Optional |
| `KMS_KEY_NAME` | Cloud KMS key for encryption | Optional |

### Email Configuration

We support SMTP via Nodemailer. Configure one of the following providers via environment variables.

#### SMTP (recommended for quick start)

Set `MAIL_PROVIDER=smtp` and the following:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@domain.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

Gmail users: Enable 2FA and create an App Password for SMTP, or use a dedicated provider (e.g., Mailgun SMTP, Sendinblue).

#### SendGrid (not yet implemented in code)

Set `MAIL_PROVIDER=sendgrid` and:

```
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

Note: The current implementation sends emails only when `MAIL_PROVIDER=smtp`. Other providers may be added later.

### Firebase Configuration

1. **Enable Services**:
   - Authentication (Email/Password, Phone, Google, Apple)
   - Firestore Database
   - Storage
   - Functions (optional)

2. **Security Rules**: Deploy the provided `firestore.rules`

3. **Indexes**: Create composite indexes for:
   - `users`: `nickname`, `status`, `genderVerificationStatus`
   - `kyc_submissions`: `status`, `createdAt`
   - `audit_logs`: `createdAt`, `actorUserId+createdAt`

## 📚 API Documentation

### Swagger UI

Access the interactive API documentation at `/docs` when running in development mode.

### Authentication

All protected endpoints require a Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

### Response Format

All API responses follow a consistent format:

```json
{
  "ok": true,
  "data": { ... },
  "error": null,
  "meta": {
    "requestId": "uuid",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### Error Handling

Errors follow the same format with appropriate HTTP status codes:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "AUTH_INVALID_TOKEN",
    "message": "Invalid or expired token"
  },
  "meta": { ... }
}
```

## 🔐 Security Features

### Rate Limiting

- **General**: 100 requests per 15 minutes per IP
- **Authentication**: 5 attempts per 15 minutes per IP
- **KYC**: 3 submissions per day per IP
- **Phone OTP**: 5 requests per 15 minutes per phone

### Data Protection

- PII encryption via Cloud KMS
- Secure file uploads with signed URLs
- Audit logging for all sensitive operations
- Input validation and sanitization

### Access Control

- Role-based permissions (admin, moderator, user)
- KYC verification status enforcement
- Device-based session management
- Secure token handling

## 🚀 Deployment

### Local Development

```bash
# Start development server
npm run dev

# Run Firebase emulators for local development
npm run emulators

# In another terminal, start the backend
npm run dev
```

### Firebase Emulators

For local development without real Firebase services:

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Start emulators
npm run emulators

# Deploy security rules to emulators
npm run deploy:rules
```

### Environment Setup

```bash
# Copy environment template
cp env.example .env

# Configure for local development
NODE_ENV=development
FIREBASE_PROJECT_ID=matcha-dev
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
ALLOW_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

### Production Build

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t matcha-backend .
docker run -p 8080:8080 matcha-backend
```

### Google Cloud Run

1. **Build and Push**:
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT_ID/matcha-backend
   ```

2. **Deploy**:
   ```bash
   gcloud run deploy matcha-backend \
     --image gcr.io/PROJECT_ID/matcha-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

3. **Update Configuration**:
   - Replace `PROJECT_ID` in `cloudrun.yaml`
   - Configure environment variables in Secret Manager
   - Set up Cloud Armor rules for additional protection

### Staging Deployment

For staging environment:

```bash
# Set staging environment
export NODE_ENV=staging
export FIREBASE_PROJECT_ID=matcha-staging

# Deploy to staging
gcloud run deploy matcha-backend-staging \
  --image gcr.io/PROJECT_ID/matcha-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=staging

# Deploy security rules
npm run deploy:rules

# Seed demo data
SEED_ALLOW=true npm run seed
```

### Production Security

- **Use Secret Manager** - Never commit `.env` files
- **Firebase security rules** - Deploy `firestore.rules` and `storage.rules`
- **CORS restrictions** - Only allow production domains
- **Rate limiting** - Stricter limits in production
- **Audit logging** - Monitor all sensitive operations

## 🚀 **Fly.io Deployment**

### **Prerequisites**

1. **Install flyctl**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly.io**:
   ```bash
   flyctl auth login
   ```

3. **Set up Firebase credentials**:
   - Download service account JSON from Firebase Console
   - Base64 encode it: `base64 -i service-account.json`

### **Quick Deployment**

#### **Staging Environment**:
```bash
# Using PowerShell (Windows)
.\scripts\deploy-fly.ps1 staging

# Using Bash (Linux/Mac)
./scripts/deploy-fly.sh staging
```

#### **Production Environment**:
```bash
# Using PowerShell (Windows)
.\scripts\deploy-fly.ps1 production

# Using Bash (Linux/Mac)
./scripts/deploy-fly.sh production
```

### **Manual Deployment**

1. **Create app**:
   ```bash
   flyctl apps create matcha-backend --org personal
   ```

2. **Set secrets**:
   ```bash
   flyctl secrets set --app matcha-backend FIREBASE_PROJECT_ID=your-project-id
   flyctl secrets set --app matcha-backend GOOGLE_APPLICATION_CREDENTIALS_JSON="$(base64 -i service-account.json)"
   flyctl secrets set --app matcha-backend ALLOW_ORIGINS=https://your-domain.com
   flyctl secrets set --app matcha-backend FRONTEND_URL=https://your-domain.com
   ```

3. **Deploy**:
   ```bash
   flyctl deploy --app matcha-backend
   ```

### **Deployment Scripts**

- **`scripts/deploy-fly.sh`** - Bash script for Linux/Mac
- **`scripts/deploy-fly.ps1`** - PowerShell script for Windows
- **`fly.toml`** - Fly.io configuration
- **`Dockerfile`** - Production Docker image
- **`.dockerignore`** - Docker build exclusions

### **Environment Variables**

Create `.env.production` or `.env.staging` with your values:
```bash
NODE_ENV=production
FIREBASE_PROJECT_ID=your-project-id
ALLOW_ORIGINS=https://your-domain.com
FRONTEND_URL=https://your-domain.com
# ... other variables
```

### **Monitoring & Scaling**

```bash
# View logs
flyctl logs --app matcha-backend

# Check status
flyctl status --app matcha-backend

# Scale resources
flyctl scale --app matcha-backend --memory 1024 --cpu 2

# View metrics
flyctl dashboard --app matcha-backend
```

## 🧪 Testing

### Run Tests

```bash
npm test
```

### Test Coverage

```bash
npm run test:coverage
```

### Test Environment

Tests use mocked Firebase services and don't require real credentials:

```bash
# Tests run with mocked Firebase Admin SDK
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Structure

- **Unit tests** - Test individual functions with mocked dependencies
- **Integration tests** - Test API endpoints with mocked Firebase
- **Mocked services** - Firebase Admin, email, audit logging
- **Test utilities** - Global test helpers and mock objects

## 🌱 Data Seeding

### Create Demo Users

```bash
# Enable seeding (safety check)
export SEED_ALLOW=true

# Run seeding script
npm run seed

# Or directly
SEED_ALLOW=true node scripts/seed.js
```

### Seeding Features

- **Demo users** - 5 pre-configured test accounts
- **Idempotent** - Safe to run multiple times
- **Auto-verification** - Email and gender verification auto-approved
- **Demo devices** - Each user gets a demo device
- **Staging ready** - Perfect for testing and demos

## 📊 Monitoring & Logging

### Health Checks

- `/healthz` - Basic health status
- `/readyz` - Service readiness
- `/healthz/live` - Liveness probe
- `/healthz/detailed` - Comprehensive health info

### Logging

- Structured JSON logging
- Request ID correlation
- PII redaction
- Cloud Logging integration

### Metrics

- Request duration tracking
- Error rate monitoring
- Custom business metrics
- Cloud Monitoring integration

## 🔄 CI/CD

### GitHub Actions

The repository includes GitHub Actions workflows for:

- Code quality checks (ESLint, Prettier)
- Automated testing
- Security scanning
- Docker image building
- Cloud Run deployment

### Pre-commit Hooks

- Husky for Git hooks
- lint-staged for staged file processing
- Automated code formatting

## 🚨 Troubleshooting

### Common Issues

1. **Firebase Connection Failed**
   - Verify service account key permissions
   - Check Firebase project configuration
   - Ensure services are enabled

2. **Rate Limiting**
   - Check client request frequency
   - Verify IP address detection
   - Review rate limit configuration

3. **Authentication Errors**
   - Verify Firebase ID token
   - Check custom claims
   - Review user status

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
```

### Health Check Failures

Check service dependencies:
- Firebase connectivity
- Firestore access
- Environment configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Style

- Follow ESLint configuration
- Use Prettier for formatting
- Write comprehensive JSDoc comments
- Follow established patterns

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Contact the development team
- Check the API documentation at `/docs`

## 🔮 Roadmap

- [ ] KYC provider integrations (Persona, Onfido, Veriff)
- [ ] Advanced analytics and reporting
- [ ] Real-time notifications
- [ ] Content moderation tools
- [ ] Advanced security features
- [ ] Performance optimizations
- [ ] Multi-region deployment
- [ ] Advanced monitoring and alerting

---

**Note**: This is a production-ready backend with security and scalability in mind. Always review security configurations before deployment and ensure compliance with relevant regulations.
