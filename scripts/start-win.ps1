# Build and start Prelegal in Docker. App: http://localhost:8000
Set-Location (Join-Path $PSScriptRoot "..")

docker build -t prelegal .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
try { docker rm -f prelegal 2>&1 | Out-Null } catch {}
if (Test-Path .env) {
    docker run -d --name prelegal -p 8000:8000 --env-file .env prelegal
} else {
    docker run -d --name prelegal -p 8000:8000 prelegal
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Prelegal is running at http://localhost:8000"
