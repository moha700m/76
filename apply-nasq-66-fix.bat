@echo off
chcp 65001 >nul
title NASQ Restart and 66 Percent Fix
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-nasq-66-fix.ps1"
set CODE=%ERRORLEVEL%
echo.
if "%CODE%"=="0" (
  echo تم الإصلاح. بعد الإغلاق احذف ملفي BAT وPS1 ولا تضفهما إلى GitHub.
) else (
  echo فشل الإصلاح. النسخة الاحتياطية محفوظة في Documents\NASQ-backups.
)
pause
exit /b %CODE%
