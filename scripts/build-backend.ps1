<#
Build script for creating the backend Windows executable using PyInstaller
and copying it into the Electron `my-anime-app/electron/backend` folder so
`electron-builder` can include it as an extra resource.

Run from the repository root in PowerShell (run as Administrator if needed):
  .\scripts\build-backend.ps1

Notes:
- This script will create (if missing) a venv at ./venv and install
  packages from requirements.txt. It then runs PyInstaller using
  the existing `run_backend.spec` file and copies the produced exe.
- The script assumes Windows and PowerShell; run on Windows to produce a
  native .exe (cross-building on Linux/WSL may require additional tools).
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "Starting backend build..." -ForegroundColor Cyan

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $repoRoot

if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..."
    python -m venv venv
}

Write-Host "Activating virtual environment..."
& "$repoRoot\venv\Scripts\Activate.ps1"

Write-Host "Upgrading pip and installing requirements..."
python -m pip install --upgrade pip
pip install -r requirements.txt

Write-Host "Running PyInstaller (using run_backend.spec)..."
pyinstaller --clean run_backend.spec

Write-Host "Locating generated executable..."
$exe = Get-ChildItem -Path "$repoRoot\dist" -Filter "run_backend.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $exe) {
    Write-Error "Could not find the generated run_backend.exe under the dist folder. Check PyInstaller output for errors."
    exit 2
}

$destDir = Join-Path $repoRoot "my-anime-app\electron\backend"
if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir | Out-Null }
$destPath = Join-Path $destDir "run_backend.exe"

Write-Host "Copying $($exe.FullName) -> $destPath"
Copy-Item $exe.FullName $destPath -Force

Write-Host "Backend build complete. Executable copied to: $destPath" -ForegroundColor Green

Write-Host "Next: run 'npm run dist' inside my-anime-app to build the electron installer (on Windows)." -ForegroundColor Yellow
