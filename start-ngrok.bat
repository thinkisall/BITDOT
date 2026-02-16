@echo off
echo ========================================
echo   BITDAMOABOM ngrok Tunnel
echo ========================================
echo.

REM 포트 설정
set PORT=3000
if not "%1"=="" set PORT=%1

echo Starting ngrok tunnel on port %PORT%...
echo Region: Japan (closest to Korea)
echo.
echo After ngrok starts, you will see a URL like:
echo https://xxxx-xxx-xxx-xxx.ngrok-free.app
echo.
echo Use this URL to access your local server from anywhere!
echo.
echo Press Ctrl+C to stop the tunnel.
echo.

REM ngrok 실행
ngrok http %PORT% --region jp

pause
