@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Install Node.js 22+ or use the public HTTPS link.& pause& exit /b 1)
if exist .env (node --env-file=.env server.mjs) else (node server.mjs)
pause
