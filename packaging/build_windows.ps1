# Build the one-folder Windows package (not onefile).
# From repo root: powershell -File packaging/build_windows.ps1

$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
Set-Location $Repo

$env:Path = "C:\Program Files\nodejs;" + [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

if (-not (Test-Path "frontend\dist\index.html")) {
    Write-Host "Building frontend/dist..."
    Push-Location frontend
    npm run build
    Pop-Location
}

python -m pip install -q -r backend\requirements.txt
python -m pip install -q -r packaging\requirements-build.txt

python -m PyInstaller --noconfirm --clean packaging\ams_v2.spec
Copy-Item -Force packaging\AMS_V2.bat dist\AIMediaStudioV2\AMS_V2.bat
Write-Host "Package: $Repo\dist\AIMediaStudioV2\AIMediaStudioV2.exe"
Write-Host "Launcher: $Repo\dist\AIMediaStudioV2\AMS_V2.bat"
