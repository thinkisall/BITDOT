@echo off
chcp 65001 > nul
echo ============================================================
echo   BITDAMOABOM API Server + Cloudflare Tunnel 시작
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/2] API 서버 시작 중... (포트 8000)
start "BITDOT API Server" cmd /k "cd /d %~dp0 && node server/index.js"

timeout /t 2 /nobreak > nul

echo [2/2] Cloudflare Tunnel 시작 중... (api.maketruthy.com)
start "BITDOT Cloudflare Tunnel" cmd /k "cloudflared tunnel --no-autoupdate run --token eyJhIjoiODEwOGQyZTQwNWZkYjkzYzA3MGM2M2RkNWNlYzY0YmIiLCJ0IjoiYjM1MzE4NjktMjE3NC00MTNmLTg5ZjgtN2ZiOWFjODk5MDFkIiwicyI6IlpqWmtZbU16Tm1NdE9HVXlZUzAwWWpkaUxUZzNaakF0WVRNd1pXSmhabUl5WkRWaSJ9"

echo.
echo ============================================================
echo   실행 완료!
echo   - API 서버:  http://localhost:8000
echo   - 터널:      https://api.maketruthy.com
echo   - 헬스체크:  http://localhost:8000/health
echo ============================================================
echo.
echo [Windows 서비스로 등록하려면 (부팅 자동 시작):]
echo   관리자 권한 CMD에서:
echo   cloudflared service install eyJhIjoiODEwOGQyZTQwNWZkYjkzYzA3MGM2M2RkNWNlYzY0YmIiLCJ0IjoiYjM1MzE4NjktMjE3NC00MTNmLTg5ZjgtN2ZiOWFjODk5MDFkIiwicyI6IlpqWmtZbU16Tm1NdE9HVXlZUzAwWWpkaUxUZzNaakF0WVRNd1pXSmhabUl5WkRWaSJ9
echo.
pause
