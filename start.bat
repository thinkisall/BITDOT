@echo off
setlocal

cd /d "%~dp0"

set NGROK="C:\Users\5800X\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"

:MENU
cls
echo.
echo ============================================================
echo    BITDOT Server Launcher
echo ============================================================
echo.
echo   [1] Production   (API + ngrok + Next.js)
echo   [2] Dev server   (API + Next.js dev)
echo   [3] API only     (port 8000)
echo   [4] Frontend only
echo   [5] ngrok only
echo   [0] Exit
echo.
set /p CHOICE=  Select:

if "%CHOICE%"=="1" goto PROD
if "%CHOICE%"=="2" goto DEV
if "%CHOICE%"=="3" goto API
if "%CHOICE%"=="4" goto FRONT
if "%CHOICE%"=="5" goto NGROK
if "%CHOICE%"=="0" goto EXIT
echo Invalid selection.
pause
goto MENU

:PROD
echo.
echo [1/3] Starting API server...
start "BITDOT API" cmd /k "cd /d %~dp0 && node server/index.js"
timeout /t 3 /nobreak > nul

echo [2/3] Starting ngrok tunnel...
start "BITDOT ngrok" cmd /k "%NGROK% http 8000"
timeout /t 3 /nobreak > nul

echo [3/3] Starting Next.js production...
start "BITDOT Frontend" cmd /k "cd /d %~dp0 && npm start"

echo.
echo Done!
echo   API:      http://localhost:8000
echo   ngrok:    http://localhost:4040
echo   Frontend: http://localhost:3000
pause
goto MENU

:DEV
echo.
echo [1/2] Starting API server...
start "BITDOT API" cmd /k "cd /d %~dp0 && node server/index.js"
timeout /t 2 /nobreak > nul

echo [2/2] Starting Next.js dev...
start "BITDOT Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo Done! API: http://localhost:8000 / Frontend: http://localhost:3000
pause
goto MENU

:API
echo.
start "BITDOT API" cmd /k "cd /d %~dp0 && node server/index.js"
echo API server started! http://localhost:8000
pause
goto MENU

:FRONT
echo.
start "BITDOT Frontend" cmd /k "cd /d %~dp0 && npm start"
echo Frontend started! http://localhost:3000
pause
goto MENU

:NGROK
echo.
start "BITDOT ngrok" cmd /k "%NGROK% http 8000"
echo ngrok started! Dashboard: http://localhost:4040
pause
goto MENU

:EXIT
echo Bye.
exit /b 0
