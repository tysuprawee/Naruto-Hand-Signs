@echo off
setlocal
set SCRIPT_DIR=%~dp0
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Start-JutsuAcademy.ps1"
exit /b %errorlevel%

