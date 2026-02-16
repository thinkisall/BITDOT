@echo off
echo ========================================
echo   BITDAMOABOM - Backend + ngrok
echo ========================================
echo.

echo [1/2] Starting backend server...
start "Backend Server" cmd /k "npm run dev:backend"

echo [2/2] Waiting 3 seconds...
timeout /t 3 /nobreak >nul

echo [3/3] Starting ngrok tunnel...
echo.
echo ========================================
echo  Copy the ngrok URL and update:
echo  .env.local file
echo ========================================
echo.
npm run ngrok:backend
