# Stop and remove the Prelegal container.
try { docker rm -f prelegal 2>&1 | Out-Null } catch {}
Write-Host "Prelegal stopped."
