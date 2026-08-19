
Write-Host "Setting up Secure File Backend..." -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host ".env created from .env.example"
    Write-Host "IMPORTANT: Edit .env and set DATABASE_URL, JWT_SECRET and FILE_ENCRYPTION_KEY."
} else {
    Write-Host ".env already exists."
}

if (-not (Test-Path "uploads")) {
    New-Item -ItemType Directory -Path "uploads" | Out-Null
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Next: npm install"
Write-Host "Then: npm start"
