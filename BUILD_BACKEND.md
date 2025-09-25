This repository includes a Python/Django backend and an Electron + Vite frontend.

This document explains how to build the backend into a Windows executable and
embed it into the Electron app so `electron-builder` packages it into the
installer (.exe / NSIS).

Prerequisites
- Windows (building a native .exe). For cross-compilation, use a Windows build agent.
- Python 3.11+ installed and on PATH
- Node.js + npm installed
- Git (optional)

Quick steps
1. From repository root, run the PowerShell build script (creates venv, installs requirements, runs PyInstaller):

```powershell
.\scripts\build-backend.ps1
```

2. This copies `run_backend.exe` into `my-anime-app/electron/backend/run_backend.exe`.

3. Build the frontend and Electron installer:

```powershell
cd my-anime-app
npm install
npm run dist
```

Notes
- The Electron `package.json` is already configured to include the backend exe as an extra resource.
- The PyInstaller spec file `run_backend.spec` bundles `collected_static` and `db.sqlite3` into the executable; verify these paths first.
- If you prefer not to install requirements globally, the script uses a virtual environment at `./venv`.

Troubleshooting
- If PyInstaller fails due to missing hooks, try upgrading `pyinstaller-hooks-contrib`.
- If the built exe fails at runtime, run it from the command prompt to see logs.
- For CI, use a Windows runner (GitHub Actions: windows-latest) to run the script and produce artifacts.
