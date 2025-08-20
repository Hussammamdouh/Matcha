# Matcha Backend Deployment Guide

Comprehensive deployment guide for the hardened Matcha backend with production-ready security and scalability features.

## 🚀 Deployment Overview

### Supported Platforms
- **Google Cloud Run** (Recommended)
- **Fly.io** (Alternative)
- **Docker** (Self-hosted)
- **Kubernetes** (Enterprise)

### Environment Strategy
- **Development**: Local with Firebase emulators
- **Staging**: Pre-production testing
- **Production**: Live user traffic

## 🔐 Pre-Deployment Checklist

### 1. Firebase Project Setup
- [ ] Firebase project created
- [ ] Firestore enabled (Native mode)
- [ ] Storage enabled
- [ ] Authentication enabled
- [ ] Service account key generated
- [ ] Security rules prepared

### 2. Environment Configuration
- [ ] Environment variables configured
- [ ] Secrets management setup
- [ ] Feature flags configured
- [ ] Rate limiting configured
- [ ] CORS origins set

### 3. Security Preparation
- [ ] Firestore rules deployed
- [ ] Storage rules deployed
- [ ] SSL certificates ready
- [ ] Domain verification complete
- [ ] Security headers configured

## 🏗️ Google Cloud Run Deployment

### Prerequisites
```bash
# Install Google Cloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Install Docker
# macOS: brew install docker
# Ubuntu: sudo apt-get install docker.io
# Windows: Download Docker Desktop

# Authenticate with Google Cloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 1. Build and Push Docker Image

```bash
# Build the image
docker build -t gcr.io/YOUR_PROJECT_ID/matcha-backend:v1.0.0 .

# Configure Docker for GCR
gcloud auth configure-docker

# Push to Google Container Registry
docker push gcr.io/YOUR_PROJECT_ID/matcha-backend:v1.0.0
```

### 2. Deploy to Cloud Run

```bash
# Deploy the service
gcloud run deploy matcha-backend \
  --image gcr.io/YOUR_PROJECT_ID/matcha-backend:v1.0.0 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --min-instances 1 \
  --timeout 300 \
  --concurrency 80
```

### 3. Configure Environment Variables

```bash
# Set environment variables
gcloud run services update matcha-backend \
  --region us-central1 \
  --set-env-vars \
    NODE_ENV=production,\
    PORT=8080,\
    FIREBASE_PROJECT_ID=YOUR_PROJECT_ID,\
    LOG_LEVEL=info
```

### 4. Set Secrets (Recommended)

```bash
# Create secrets
echo -n "your-private-key" | gcloud secrets create firebase-private-key --data-file=-
echo -n "your-client-email" | gcloud secrets create firebase-client-email --data-file=-
echo -n "your-storage-bucket" | gcloud secrets create firebase-storage-bucket --data-file=-

# Update service to use secrets
gcloud run services update matcha-backend \
  --region us-central1 \
  --set-secrets \
    FIREBASE_PRIVATE_KEY=firebase-private-key:latest,\
    FIREBASE_CLIENT_EMAIL=firebase-client-email:latest,\
    FIREBASE_STORAGE_BUCKET=firebase-storage-bucket:latest
```

## 🚁 Fly.io Deployment

### Prerequisites
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login to Fly.io
flyctl auth login
```

### 1. Create App

```bash
# Create the application
flyctl apps create matcha-backend

# Set organization (if needed)
flyctl apps create matcha-backend --org your-org
```

### 2. Configure Deployment

```bash
# Copy configuration
cp fly.toml.example fly.toml

# Edit fly.toml with your configuration
# Update app name, region, and other settings
```

### 3. Set Secrets

```bash
# Set Firebase credentials
flyctl secrets set FIREBASE_PROJECT_ID="your-project-id"
flyctl secrets set FIREBASE_PRIVATE_KEY="your-private-key"
flyctl secrets set FIREBASE_CLIENT_EMAIL="your-client-email"
flyctl secrets set FIREBASE_STORAGE_BUCKET="your-bucket"

# Set other environment variables
flyctl secrets set NODE_ENV="production"
flyctl secrets set LOG_LEVEL="info"
flyctl secrets set CORS_ORIGINS="https://yourdomain.com"
```

### 4. Deploy

```bash
# Deploy the application
flyctl deploy

# Check status
flyctl status

# View logs
flyctl logs
```

## 🐳 Docker Deployment

### 1. Build Image

```bash
# Build production image
docker build -t matcha-backend:latest .

# Tag for registry
docker tag matcha-backend:latest your-registry/matcha-backend:latest
```

### 2. Run Container

```bash
# Run with environment variables
docker run -d \
  --name matcha-backend \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e FIREBASE_PROJECT_ID=your-project-id \
  -e FIREBASE_PRIVATE_KEY=your-private-key \
  -e FIREBASE_CLIENT_EMAIL=your-client-email \
  -e FIREBASE_STORAGE_BUCKET=your-bucket \
  matcha-backend:latest
```

### 3. Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  matcha-backend:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
      - FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY}
      - FIREBASE_CLIENT_EMAIL=${FIREBASE_CLIENT_EMAIL}
      - FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 🔒 Security Rules Deployment

### 1. Firestore Rules

```bash
# Deploy to production
firebase deploy --only firestore:rules --project YOUR_PROJECT_ID

# Deploy to staging
firebase deploy --only firestore:rules --project YOUR_STAGING_PROJECT_ID

# Validate rules
firebase emulators:start --only firestore
firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

### 2. Storage Rules

```bash
# Deploy to production
firebase deploy --only storage --project YOUR_PROJECT_ID

# Deploy to staging
firebase deploy --only storage --project YOUR_STAGING_PROJECT_ID

# Validate rules
firebase emulators:start --only storage
firebase deploy --only storage --project YOUR_PROJECT_ID
```

### 3. Verify Deployment

```bash
# Check Firestore rules
firebase firestore:rules:get --project YOUR_PROJECT_ID

# Check Storage rules
firebase storage:rules:get --project YOUR_PROJECT_ID
```

## 📊 Monitoring Setup

### 1. Cloud Monitoring

```bash
# Enable monitoring APIs
gcloud services enable monitoring.googleapis.com
gcloud services enable cloudtrace.googleapis.com
gcloud services enable cloudprofiler.googleapis.com

# Create monitoring dashboard
# Navigate to Cloud Console > Monitoring > Dashboards
# Import the provided dashboard configuration
```

### 2. Logging Configuration

```bash
# Set log retention
gcloud logging sinks create matcha-backend-logs \
  storage.googleapis.com/YOUR_PROJECT_ID-matcha-logs \
  --log-filter="resource.type=cloud_run_revision AND resource.labels.service_name=matcha-backend"

# Set log retention policy
gcloud logging buckets update _Default \
  --location=global \
  --retention-days=30
```

### 3. Alerting Policies

```bash
# Create uptime alert
gcloud alpha monitoring policies create \
  --policy-from-file=monitoring/uptime-policy.yaml

# Create error rate alert
gcloud alpha monitoring policies create \
  --policy-from-file=monitoring/error-rate-policy.yaml
```

## 🔄 CI/CD Pipeline

### 1. GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Build Docker image
        run: docker build -t matcha-backend:${{ github.sha }} .
        
      - name: Deploy to Cloud Run
        run: |
          gcloud auth configure-docker
          docker tag matcha-backend:${{ github.sha }} \
            gcr.io/${{ secrets.GCP_PROJECT_ID }}/matcha-backend:${{ github.sha }}
          docker push gcr.io/${{ secrets.GCP_PROJECT_ID }}/matcha-backend:${{ github.sha }}
          
          gcloud run deploy matcha-backend \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/matcha-backend:${{ github.sha }} \
            --region us-central1 \
            --platform managed
```

### 2. Environment Promotion

```bash
# Promote from staging to production
gcloud run services update matcha-backend \
  --region us-central1 \
  --image gcr.io/YOUR_PROJECT_ID/matcha-backend:staging-v1.0.0

# Rollback if needed
gcloud run services update matcha-backend \
  --region us-central1 \
  --image gcr.io/YOUR_PROJECT_ID/matcha-backend:previous-version
```

## 🧪 Testing Deployment

### 1. Health Checks

```bash
# Basic health
curl https://your-service-url/healthz

# Readiness check
curl https://your-service-url/readyz

# Detailed health
curl https://your-service-url/healthz/detailed

# Metrics
curl https://your-service-url/metrics
```

### 2. Smoke Tests

```bash
# Test authentication
curl -X POST https://your-service-url/api/v1/auth/verify \
  -H "Authorization: Bearer YOUR_TEST_TOKEN"

# Test rate limiting
for i in {1..6}; do
  curl -X POST https://your-service-url/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}'
done
```

### 3. Load Testing

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery run load-tests/basic-load.yml

# Run stress test
artillery run load-tests/stress-test.yml
```

## 🚨 Post-Deployment

### 1. Verification Checklist

- [ ] Health endpoints responding
- [ ] Authentication working
- [ ] Rate limiting enforced
- [ ] Security rules active
- [ ] Monitoring data flowing
- [ ] Logs being generated
- [ ] Error tracking working

### 2. Performance Monitoring

```bash
# Check response times
gcloud monitoring metrics list --filter="metric.type:run.googleapis.com/request_count"

# Monitor error rates
gcloud monitoring metrics list --filter="metric.type:run.googleapis.com/request_latencies"
```

### 3. Security Verification

```bash
# Test rate limiting
curl -X POST https://your-service-url/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Verify CORS
curl -H "Origin: https://malicious-site.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-Requested-With" \
  -X OPTIONS https://your-service-url/api/v1/auth/login
```

## 🔧 Troubleshooting

### Common Issues

1. **Service won't start**
   - Check environment variables
   - Verify Firebase credentials
   - Check logs for errors

2. **Authentication failures**
   - Verify Firebase project ID
   - Check service account permissions
   - Validate ID token format

3. **Rate limiting too strict**
   - Adjust rate limit configuration
   - Check Redis connectivity
   - Monitor user activity patterns

4. **Performance issues**
   - Check instance scaling
   - Monitor memory usage
   - Review database queries

### Debug Commands

```bash
# View service logs
gcloud run services logs read matcha-backend --region us-central1

# Check service status
gcloud run services describe matcha-backend --region us-central1

# Test connectivity
gcloud run services list --region us-central1
```

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Fly.io Documentation](https://fly.io/docs/)
- [Docker Documentation](https://docs.docker.com/)

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Maintainer**: Matcha Backend Team



