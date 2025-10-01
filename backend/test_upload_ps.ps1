# PowerShell test for direct media upload

$baseUrl = "http://localhost:8080"
$email = "user1@example.com"
$password = "Password!123"

# Step 1: Login
Write-Host "Step 1: Logging in..." -ForegroundColor Green
$loginBody = @{
    email = $email
    password = $password
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.data.idToken
    $uid = $loginResponse.data.localId
    Write-Host "✅ Login successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Create conversation
Write-Host "`nStep 2: Creating conversation..." -ForegroundColor Green
$convBody = @{
    participantIds = @("test-user-2")
    type = "direct"
} | ConvertTo-Json

try {
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    $convResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/chat/conversation" -Method POST -Body $convBody -Headers $headers
    $conversationId = $convResponse.data.id
    Write-Host "✅ Conversation created: $conversationId" -ForegroundColor Green
} catch {
    Write-Host "❌ Create conversation failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Test direct upload
Write-Host "`nStep 3: Testing direct upload..." -ForegroundColor Green

# Create a test file
$testContent = "This is a test file for direct upload"
$testFilePath = ".\test-upload.txt"
Set-Content -Path $testFilePath -Value $testContent

try {
    # Create form data for multipart upload
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    
    $bodyLines = @(
        "--$boundary",
        "Content-Disposition: form-data; name=`"text`"",
        "",
        "Test message with file upload",
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"test-upload.txt`"",
        "Content-Type: text/plain",
        "",
        $testContent,
        "--$boundary--"
    )
    
    $body = $bodyLines -join $LF
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "multipart/form-data; boundary=$boundary"
    }
    
    $uploadResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/chat/conversation/$conversationId/message" -Method POST -Body $body -Headers $headers
    Write-Host "✅ Direct upload successful!" -ForegroundColor Green
    Write-Host "Response: $($uploadResponse | ConvertTo-Json -Depth 3)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Direct upload failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody" -ForegroundColor Yellow
    }
} finally {
    # Clean up test file
    if (Test-Path $testFilePath) {
        Remove-Item $testFilePath
    }
}

Write-Host "`nTest completed!" -ForegroundColor Magenta

