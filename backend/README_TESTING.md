# Registration Flow Testing Guide

This guide explains how to test the complete registration process with image upload and AI integration.

## Prerequisites

1. **Backend Server** running on port 8080
2. **AI Server** running on port 8000
3. **Test Images** available in `postman/` folder:
   - `female.jpeg` - High confidence female image
   - `female100%.jpeg` - Very high confidence female image  
   - `male.jpeg` - Male image (should be rejected)

## Environment Setup

The backend needs the `AI_SERVICE_URL` environment variable set to connect to the AI service.

### Option 1: Use the startup script
```powershell
powershell -ExecutionPolicy Bypass -File start_backend_with_ai.ps1
```

### Option 2: Set environment variable manually
```powershell
$env:AI_SERVICE_URL = "http://localhost:8000"
npm start
```

### Option 3: Create .env file
Create a `.env` file in the backend directory with:
```
AI_SERVICE_URL=http://localhost:8000
NODE_ENV=development
```

## Available Test Scripts

### 1. Quick Test (`test_registration_simple.js`)
Tests basic registration flow with one image:
```bash
node test_registration_simple.js
```

### 2. Complete Test Suite (`test_registration_complete.js`)
Tests all scenarios including edge cases:
```bash
node test_registration_complete.js
```

### 3. AI Service Direct Test (`test_ai_direct.js`)
Tests AI service directly without backend:
```bash
node test_ai_direct.js
```

### 4. PowerShell Test Runner (`test_registration.ps1`)
Interactive test runner with options:
```powershell
powershell -ExecutionPolicy Bypass -File test_registration.ps1
```

## Test Scenarios

### Registration with Image Upload
- ✅ User registration with email/password/nickname
- ✅ Direct image upload via multipart/form-data
- ✅ Cloudinary integration for image storage
- ✅ Avatar URL automatically set from uploaded image

### AI Gender Verification
- ✅ AI service integration for gender inference
- ✅ Three decision types:
  - **Approved** (≥80% female confidence) - Auto-approve
  - **Pending** (50-79% female confidence) - Manual review
  - **Rejected** (<50% female confidence or male) - Auto-reject

### Database Operations
- ✅ Firebase user creation
- ✅ Firestore user profile creation
- ✅ Gender verification status updates
- ✅ Custom claims updates
- ✅ Audit logs for admin/IT dashboards

## Expected Results

### Female Images (High Confidence)
```json
{
  "ok": true,
  "data": {
    "decision": "approved",
    "gender": "female",
    "confidence": 0.81,
    "message": "User approved automatically - certified female"
  }
}
```

### Male Images
```json
{
  "ok": true,
  "data": {
    "decision": "rejected",
    "gender": "male",
    "confidence": 0.85,
    "message": "User rejected automatically - sent to IT dashboard for IP banning"
  }
}
```

## Troubleshooting

### Common Issues

1. **"AI_SERVICE_URL is not configured"**
   - Set the environment variable: `$env:AI_SERVICE_URL = "http://localhost:8000"`

2. **"Backend server not responding"**
   - Start backend server: `npm start`
   - Check if running on port 8080

3. **"AI server not responding"**
   - Start AI server: `uvicorn AI.app.main:app --reload`
   - Check if running on port 8000

4. **"Registration failed: Validation error"**
   - Check nickname format (alphanumeric, underscore, dash only)
   - Ensure email is valid format
   - Password must be at least 8 characters

5. **"Selfie processing failed: 500 error"**
   - Verify AI_SERVICE_URL is set in backend environment
   - Check AI server health: `curl http://localhost:8000/healthz`
   - Check backend logs for detailed error

### Health Checks

```bash
# Backend health
curl http://localhost:8080/healthz

# AI service health  
curl http://localhost:8000/healthz

# Backend readiness (includes AI check)
curl http://localhost:8080/readyz
```

## Test Results Interpretation

- **Registration Success**: User created in Firebase, profile in Firestore
- **AI Approval**: User status = "approved", custom claims = "gv:approved"
- **AI Rejection**: User status = "rejected", IT ticket created
- **AI Pending**: User status = "pending_review", admin review created

## Next Steps

After successful testing:
1. Verify user appears in Firebase Console
2. Check Firestore collections: `users`, `gender_checks`, `admin_reviews`, `it_tickets`
3. Test admin dashboard for pending reviews
4. Test IT dashboard for rejected users


