# PowerShell script to run registration tests
# Make sure both servers are running: Backend (8080) and AI (8000)

Write-Host "🚀 Registration Flow Test Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Check if Node.js is available
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Check if npm dependencies are installed
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installing npm dependencies..." -ForegroundColor Yellow
    npm install
}

# Check if test images exist
$postmanPath = "postman"
$requiredImages = @("female.jpeg", "male.jpeg", "female100%.jpeg")

Write-Host "`n📁 Checking test images..." -ForegroundColor Blue
foreach ($image in $requiredImages) {
    $imagePath = Join-Path $postmanPath $image
    if (Test-Path $imagePath) {
        Write-Host "✅ Found: $image" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $image" -ForegroundColor Red
    }
}

# Check server endpoints
Write-Host "`n📡 Checking servers..." -ForegroundColor Blue

try {
    $backendResponse = Invoke-WebRequest -Uri "http://localhost:8080/healthz" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✅ Backend server (8080) is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend server (8080) not responding" -ForegroundColor Red
    Write-Host "   Please start the backend server first" -ForegroundColor Yellow
}

try {
    $aiResponse = Invoke-WebRequest -Uri "http://localhost:8000/healthz" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✅ AI server (8000) is running" -ForegroundColor Green
} catch {
    Write-Host "❌ AI server (8000) not responding" -ForegroundColor Red
    Write-Host "   Please start the AI server first" -ForegroundColor Yellow
}

Write-Host "`n🧪 Available Tests:" -ForegroundColor Magenta
Write-Host "1. Quick Test (recommended)" -ForegroundColor White
Write-Host "2. Complete Test Suite" -ForegroundColor White
Write-Host "3. Exit" -ForegroundColor White

$choice = Read-Host "`nSelect test (1-3)"

switch ($choice) {
    "1" {
        Write-Host "`n🚀 Running Quick Test..." -ForegroundColor Cyan
        node test_registration_simple.js
    }
    "2" {
        Write-Host "`n🚀 Running Complete Test Suite..." -ForegroundColor Cyan
        node test_registration_complete.js
    }
    "3" {
        Write-Host "👋 Goodbye!" -ForegroundColor Yellow
        exit 0
    }
    default {
        Write-Host "❌ Invalid choice. Please run the script again." -ForegroundColor Red
    }
}

Write-Host "`n🏁 Test completed!" -ForegroundColor Green


