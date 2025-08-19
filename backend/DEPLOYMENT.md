# 🚀 Fly.io Deployment Checklist

## ✅ **Pre-Deployment Setup**

### **1. Firebase Project Setup**
- [ ] Create Firebase project in console
- [ ] Enable Authentication (Email/Password, Google, Apple)
- [ ] Enable Firestore Database
- [ ] Enable Storage
- [ ] Download service account JSON
- [ ] Base64 encode service account: `base64 -i service-account.json`

### **2. Fly.io Setup**
- [ ] Install flyctl: `curl -L https://fly.io/install.sh | sh`
- [ ] Login: `flyctl auth login`
- [ ] Verify account: `flyctl auth whoami`

### **3. Environment Configuration**
- [ ] Create `.env.production` with real values
- [ ] Create `.env.staging` with real values
- [ ] Verify all required variables are set

## 🚀 **Deployment Commands**

### **Staging Deployment**
```bash
# Windows PowerShell
.\scripts\deploy-fly.ps1 staging

# Linux/Mac Bash
./scripts/deploy-fly.sh staging
```

### **Production Deployment**
```bash
# Windows PowerShell
.\scripts\deploy-fly.ps1 production

# Linux/Mac Bash
./scripts/deploy-fly.sh production
```

## 🔐 **Required Secrets**

Set these secrets for your Fly.io app:

```bash
# Firebase Configuration
flyctl secrets set --app matcha-backend FIREBASE_PROJECT_ID=your-project-id
flyctl secrets set --app matcha-backend GOOGLE_APPLICATION_CREDENTIALS_JSON="base64-encoded-json"

# CORS & Security
flyctl secrets set --app matcha-backend ALLOW_ORIGINS=https://your-domain.com
flyctl secrets set --app matcha-backend FRONTEND_URL=https://your-domain.com

# Logging
flyctl secrets set --app matcha-backend LOG_REDACT_KEYS=authorization,password,idToken,refreshToken

# Rate Limiting
flyctl secrets set --app matcha-backend AUTH_RATE_LIMIT_MAX_REQUESTS=5
flyctl secrets set --app matcha-backend AUTH_RATE_LIMIT_WINDOW_MS=900000

# Email (if using SMTP)
flyctl secrets set --app matcha-backend SMTP_HOST=smtp.gmail.com
flyctl secrets set --app matcha-backend SMTP_USER=your-email@domain.com
flyctl secrets set --app matcha-backend SMTP_PASS=your-app-password
```

## 🧪 **Post-Deployment Testing**

### **1. Health Check**
```bash
curl https://your-app.fly.dev/healthz
```

### **2. API Testing**
- [ ] Test authentication endpoints
- [ ] Test user profile endpoints
- [ ] Test device management
- [ ] Test avatar uploads
- [ ] Verify CORS headers
- [ ] Test rate limiting

### **3. Firebase Integration**
- [ ] Verify Firebase Admin SDK connection
- [ ] Test Firestore operations
- [ ] Test Storage operations
- [ ] Verify security rules

## 📊 **Monitoring & Maintenance**

### **Daily Operations**
```bash
# Check app status
flyctl status --app matcha-backend

# View recent logs
flyctl logs --app matcha-backend --limit 50

# Monitor resource usage
flyctl dashboard --app matcha-backend
```

### **Scaling**
```bash
# Scale memory
flyctl scale --app matcha-backend --memory 1024

# Scale CPU
flyctl scale --app matcha-backend --cpu 2

# Scale instances
flyctl scale --app matcha-backend --count 3
```

### **Updates & Rollbacks**
```bash
# Deploy new version
flyctl deploy --app matcha-backend

# Rollback to previous version
flyctl deploy --app matcha-backend --image-label v1.0.0

# View deployment history
flyctl releases --app matcha-backend
```

## 🔒 **Security Checklist**

- [ ] All secrets are set (no .env files in production)
- [ ] CORS origins are restricted to your domains
- [ ] Rate limiting is properly configured
- [ ] Firebase security rules are deployed
- [ ] HTTPS is enforced
- [ ] Non-root user in Docker container
- [ ] Health checks are configured
- [ ] Logging is properly configured

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Build Failures**
   - Check Dockerfile syntax
   - Verify all files are included
   - Check .dockerignore exclusions

2. **Runtime Errors**
   - Check Fly.io logs: `flyctl logs --app matcha-backend`
   - Verify secrets are set correctly
   - Check Firebase credentials

3. **Performance Issues**
   - Monitor resource usage
   - Scale resources if needed
   - Check database performance

### **Support Resources**
- [Fly.io Documentation](https://fly.io/docs/)
- [Fly.io Community](https://community.fly.io/)
- [Firebase Documentation](https://firebase.google.com/docs)

## 📝 **Deployment Notes**

- **App Name**: matcha-backend (production) / matcha-backend-staging (staging)
- **Region**: iad (Washington DC) - change in fly.toml if needed
- **Resources**: 1 CPU, 512MB RAM (configurable)
- **Health Check**: /healthz endpoint
- **Port**: 8080 (internal), 80/443 (external)

