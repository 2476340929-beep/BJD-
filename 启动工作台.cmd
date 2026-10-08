@echo off
chcp 65001 >nul
cd /d "%~dp0"
"%~dp0运行环境\node.exe" "%~dp0运行环境\server.cjs"
if errorlevel 1 pause
