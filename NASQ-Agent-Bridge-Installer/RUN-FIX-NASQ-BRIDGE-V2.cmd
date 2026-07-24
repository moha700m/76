@echo off
setlocal
title NASQ Agent Bridge - TypeScript Fix V2
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0FIX-NASQ-BRIDGE-TYPESCRIPT.ps1" -StartDir "%~dp0."
set "CODE=%ERRORLEVEL%"
echo.
if "%CODE%"=="0" (
  echo SUCCESS. Send DONE in ChatGPT.
) else (
  echo FAILED. Send a photo of the error.
)
echo.
pause
exit /b %CODE%
