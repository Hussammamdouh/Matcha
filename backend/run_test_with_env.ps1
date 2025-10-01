# Set environment variables and run the registration test
$env:AI_SERVICE_URL = "http://localhost:8000"
$env:NODE_ENV = "development"

Write-Host "Environment variables set:" -ForegroundColor Cyan
Write-Host "AI_SERVICE_URL = $env:AI_SERVICE_URL" -ForegroundColor Green
Write-Host "NODE_ENV = $env:NODE_ENV" -ForegroundColor Green

Write-Host "Running registration test..." -ForegroundColor Yellow
node test_registration_simple.js
