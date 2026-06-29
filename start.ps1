# DecisionOS Startup Script (Windows PowerShell)

Write-Host "⚡ Starting DecisionOS..." -ForegroundColor Cyan

$envFile = "backend\.env"
if (Test-Path $envFile) {
    $content = Get-Content $envFile -Raw
    if ($content -match "your_gemini_api_key_here") {
        Write-Host ""
        Write-Host "⚠️  ACTION REQUIRED: Add your API key to backend\.env" -ForegroundColor Yellow
        Write-Host "   Get a free Gemini API key at: https://ai.google.dev/" -ForegroundColor Yellow
        Write-Host "   Then edit backend\.env and set GEMINI_API_KEY=your_actual_key" -ForegroundColor Yellow
        Write-Host ""
    }
}

Write-Host "📦 Starting Backend (FastAPI)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python -m uvicorn app.main:app --port 8000" -WorkingDirectory "$PSScriptRoot\backend"

Start-Sleep -Seconds 2

Write-Host "🎨 Starting Frontend (Next.js)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WorkingDirectory "$PSScriptRoot\frontend"

Write-Host ""
Write-Host "✅ DecisionOS is starting!" -ForegroundColor Green
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "   Backend:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "   API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
