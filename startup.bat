@echo off
cd /d C:\workspace\BITDOT

start "BITDOT API" cmd /k "cd /d C:\workspace\BITDOT && node server/index.js"
timeout /t 3 /nobreak > nul
start "BITDOT Frontend" cmd /k "cd /d C:\workspace\BITDOT && npm start"
