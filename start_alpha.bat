@echo off
setlocal EnableDelayedExpansion

title Alpha_Insight Launcher

echo =====================================================================
echo                ALPHA_INSIGHT - LOCAL WORKSTATION LAUNCHER
echo =====================================================================
echo.

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

:: 1. Verify Prerequisites
where uv >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 'uv' was not found on PATH.
    echo Please ensure uv is installed or add it to PATH.
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 'npm' was not found on PATH.
    echo Please install Node.js / npm to run the frontend.
    pause
    exit /b 1
)

:: 2. Check Port 8080 [Backend]
netstat -ano | findstr ":8080" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Backend is already running on http://127.0.0.1:8080
) else (
    echo [STARTING] Launching FastAPI Backend on http://127.0.0.1:8080...
    start "Alpha_Insight Backend [8080]" cmd /k "cd /d "%PROJECT_ROOT%" && uv run uvicorn backend.main:app --host 127.0.0.1 --port 8080 --reload"
)

:: 3. Check Port 5173 [Frontend]
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Frontend is already running on http://127.0.0.1:5173
) else (
    echo [STARTING] Launching Vite Frontend on http://127.0.0.1:5173...
    start "Alpha_Insight Frontend [5173]" cmd /k "cd /d "%PROJECT_ROOT%frontend" && npm run dev -- --host 127.0.0.1 --port 5173"
)

echo.
echo Waiting for servers to initialize...
timeout /t 3 /nobreak >nul 2>&1

:: 4. Open Browser
echo [OPENING] Launching default web browser at http://127.0.0.1:5173/...
start http://127.0.0.1:5173/

echo.
echo =====================================================================
echo   Alpha_Insight is running:
echo   - Frontend Workstation:  http://127.0.0.1:5173/
echo   - Backend REST API Docs: http://127.0.0.1:8080/docs
echo.
echo   To stop both servers later, run: stop_alpha.bat
echo   [or close the individual console windows]
echo =====================================================================
echo.
