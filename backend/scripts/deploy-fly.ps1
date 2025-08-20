# Fly.io Deployment Script for Matcha Backend (PowerShell)
# Usage: .\scripts\deploy-fly.ps1 [staging|production]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("staging", "production")]
    [string]$Environment
)

# Error handling
$ErrorActionPreference = "Stop"

# Colors for output
function Write-Status { Write-Host "[INFO] $args" -ForegroundColor Blue }
function Write-Success { Write-Host "[SUCCESS] $args" -ForegroundColor Green }
function Write-Warning { Write-Host "[WARNING] $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red }

# Check if flyctl is installed
function Test-Flyctl {
    try {
        $null = Get-Command flyctl -ErrorAction Stop
        Write-Success "flyctl is installed"
    }
    catch {
        Write-Error "flyctl is not installed. Please install it first:"
        Write-Host "curl -L https://fly.io/install.sh | sh" -ForegroundColor Cyan
        exit 1
    }
}

# Check if user is logged in to Fly.io
function Test-FlyAuth {
    try {
        $null = flyctl auth whoami 2>$null
        Write-Success "Authenticated with Fly.io"
    }
    catch {
        Write-Error "Not logged in to Fly.io. Please run: flyctl auth login"
        exit 1
    }
}

# Set environment variables
function Set-Environment {
    if ($Environment -eq "production") {
        $script:AppName = "matcha-backend"
        $script:Region = "iad"
    }
    else {
        $script:AppName = "matcha-backend-staging"
        $script:Region = "iad"
    }
    
    Write-Status "Deploying to $Environment environment: $AppName"
}

# Create app if it doesn't exist
function New-FlyApp {
    try {
        $apps = flyctl apps list 2>$null | Select-String $AppName
        if ($apps) {
            Write-Status "App already exists: $AppName"
        }
        else {
            Write-Status "Creating new Fly.io app: $AppName"
            flyctl apps create $AppName --org personal
            Write-Success "App created: $AppName"
        }
    }
    catch {
        Write-Error "Failed to create app: $($_.Exception.Message)"
        exit 1
    }
}

# Set secrets for the app
function Set-FlySecrets {
    Write-Status "Setting secrets for $AppName..."
    
    $envFile = ".env.$Environment"
    if (-not (Test-Path $envFile)) {
        Write-Warning "No $envFile file found. You'll need to set secrets manually."
        Write-Status "Run: flyctl secrets set --app $AppName KEY=value"
        return
    }
    
    # Read environment file and set secrets
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        
        # Skip comments and empty lines
        if ($line -and -not $line.StartsWith("#")) {
            if ($line -match "^([^=]+)=(.*)$") {
                $key = $matches[1]
                $value = $matches[2]
                
                # Skip if value is empty or contains placeholder
                if ($value -and -not $value.Contains("your-")) {
                    Write-Status "Setting secret: $key"
                    try {
                        flyctl secrets set --app $AppName "$key=$value" 2>$null
                    }
                    catch {
                        Write-Warning "Failed to set secret $key"
                    }
                }
            }
        }
    }
    
    Write-Success "Secrets configured"
}

# Deploy the application
function Deploy-FlyApp {
    Write-Status "Deploying $AppName to Fly.io..."
    
    try {
        flyctl deploy --app $AppName --region $Region
        Write-Success "Deployment completed!"
    }
    catch {
        Write-Error "Deployment failed: $($_.Exception.Message)"
        exit 1
    }
}

# Show deployment status
function Show-FlyStatus {
    Write-Status "Deployment status:"
    try {
        flyctl status --app $AppName
    }
    catch {
        Write-Warning "Could not get status"
    }
    
    Write-Status "Recent logs:"
    try {
        flyctl logs --app $AppName --limit 10
    }
    catch {
        Write-Warning "Could not get logs"
    }
}

# Main deployment function
function Main {
    Write-Status "Starting Fly.io deployment..."
    
    # Check prerequisites
    Test-Flyctl
    Test-FlyAuth
    
    # Set environment
    Set-Environment
    
    # Deploy
    New-FlyApp
    Set-FlySecrets
    Deploy-FlyApp
    Show-FlyStatus
    
    Write-Success "Deployment to $Environment completed successfully!"
    Write-Status "Your app is available at: https://$AppName.fly.dev"
}

# Run main function
Main




