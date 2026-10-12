@echo off
cd /d "%~dp0"
node build.mjs
if errorlevel 1 exit /b 1
node server.mjs
