@echo off
chcp 65001 > nul
echo ============================================================
echo   BITDAMOABOM API Server 시작
echo ============================================================
echo.
echo [정보] Cloudflare Tunnel은 Windows 서비스로 이미 등록되어 있습니다.
echo        (cloudflared.exe service install 로 설치됨)
echo.

cd /d "%~dp0"

echo [1/1] API 서버 시작 중... (포트 3001)
echo.

node server/index.js

pause
