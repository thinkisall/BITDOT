@echo off
setlocal

cd /d "%~dp0"

:MENU
cls
echo.
echo ============================================================
echo    BITDOT Server Launcher
echo ============================================================
echo.
echo   [1] Dev server   (Next.js dev + API server)
echo   [2] Production   (PM2 full stack)
echo   [3] API only     (port 8000)
echo   [4] Frontend only (Next.js dev, port 3000)
echo   [5] Status       (PM2 status)
echo   [6] Stop all     (PM2 stop all)
echo   [7] Restart all  (PM2 restart all)
echo   [8] Logs         (PM2 logs)
echo   [0] Exit
echo.
set /p CHOICE=  Select:

if "%CHOICE%"=="1" goto DEV
if "%CHOICE%"=="2" goto PROD
if "%CHOICE%"=="3" goto API
if "%CHOICE%"=="4" goto FRONT
if "%CHOICE%"=="5" goto STATUS
if "%CHOICE%"=="6" goto STOP
if "%CHOICE%"=="7" goto RESTART
if "%CHOICE%"=="8" goto LOGS
if "%CHOICE%"=="0" goto EXIT
echo Invalid selection.
pause
goto MENU

:DEV
echo.
echo [DEV] Starting Next.js + API server...
start "BITDOT API" cmd /k "cd /d "%~dp0" && node server/index.js"
timeout /t 2 /nobreak > nul
start "BITDOT Frontend" cmd /k "cd /d "%~dp0" && npm run dev"
echo Done! API: http://localhost:8000 / Frontend: http://localhost:3000
pause
goto MENU

:PROD
echo.
echo [PROD] Starting with PM2...
where pm2 >nul 2>&1
if errorlevel 1 (echo PM2 not found. Run: npm install -g pm2 && pause && goto MENU)
npm run build
pm2 start ecosystem.config.js
pm2 status
pause
goto MENU

:API
echo.
echo [API] Starting API server on port 8000...
start "BITDOT API" cmd /k "cd /d "%~dp0" && node server/index.js"
echo API server started! http://localhost:8000
pause
goto MENU

:FRONT
echo.
echo [FRONT] Starting Next.js dev on port 3000...
start "BITDOT Frontend" cmd /k "cd /d "%~dp0" && npm run dev"
echo Frontend started! http://localhost:3000
pause
goto MENU

:STATUS
echo.
where pm2 >nul 2>&1
if errorlevel 1 (echo PM2 not found. && pause && goto MENU)
pm2 status
pause
goto MENU

:STOP
echo.
where pm2 >nul 2>&1
if errorlevel 1 (echo PM2 not found. && pause && goto MENU)
pm2 stop all
pm2 status
pause
goto MENU

:RESTART
echo.
where pm2 >nul 2>&1
if errorlevel 1 (echo PM2 not found. && pause && goto MENU)
pm2 restart all
pm2 status
pause
goto MENU

:LOGS
echo.
where pm2 >nul 2>&1
if errorlevel 1 (echo PM2 not found. && pause && goto MENU)
pm2 logs
pause
goto MENU

:EXIT
echo Bye.
exit /b 0
