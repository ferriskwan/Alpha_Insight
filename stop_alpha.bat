@echo off
setlocal EnableDelayedExpansion

title Alpha_Insight Stopper

echo =====================================================================
echo                ALPHA_INSIGHT - LOCAL SERVER STOPPER
echo =====================================================================
echo.

set "STOPPED=0"

:: Stop process on port 8080 (Backend)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do (
    set "PID=%%a"
    if defined PID (
        echo [STOPPING] Terminating Backend process [PID !PID!] on port 8080...
        taskkill /F /PID !PID! >nul 2>&1
        set "STOPPED=1"
    )
)

:: Stop process on port 5173 (Frontend)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    set "PID=%%a"
    if defined PID (
        echo [STOPPING] Terminating Frontend process [PID !PID!] on port 5173...
        taskkill /F /PID !PID! >nul 2>&1
        set "STOPPED=1"
    )
)

if "!STOPPED!"=="0" (
    echo [INFO] No active Alpha_Insight server processes found on port 8080 or 5173.
) else (
    echo [SUCCESS] Alpha_Insight server processes stopped.
)

echo.
timeout /t 2 /nobreak >nul 2>&1
