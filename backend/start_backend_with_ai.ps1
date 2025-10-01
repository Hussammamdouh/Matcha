# Start backend server with AI service URL configured
$env:AI_SERVICE_URL = "http://localhost:8000"
$env:NODE_ENV = "development"

Write-Host "Starting Backend Server with AI Integration" -ForegroundColor Cyan
Write-Host "AI_SERVICE_URL = $env:AI_SERVICE_URL" -ForegroundColor Green
Write-Host "NODE_ENV = $env:NODE_ENV" -ForegroundColor Green

Write-Host "`nMake sure AI server is running on port 8000" -ForegroundColor Yellow
Write-Host "Starting backend server..." -ForegroundColor Yellow

npm start


