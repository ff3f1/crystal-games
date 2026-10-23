@echo off
setlocal
cd /d "%~dp0"
title Fishing: ComfyUI assets
set "PYEXE="
set "PYARG="
for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('MyDocuments')"`) do set "DOCS=%%D"
if not defined DOCS set "DOCS=%USERPROFILE%\Documents"
for %%P in (
  "%DOCS%\ai-assets\ComfyUI_windows_portable\python_embeded\python.exe"
  "%DOCS%\ai-assets\ComfyUI\python_embeded\python.exe"
  "%DOCS%\ai-assets\python_embeded\python.exe"
  "%DOCS%\ai-assets\ComfyUI\.venv\Scripts\python.exe"
  "%DOCS%\ai-assets\ComfyUI\venv\Scripts\python.exe"
  "%DOCS%\ComfyUI\.venv\Scripts\python.exe"
  "%USERPROFILE%\ComfyUI_windows_portable\python_embeded\python.exe"
  "C:\ComfyUI_windows_portable\python_embeded\python.exe"
) do if not defined PYEXE if exist %%P set "PYEXE=%%~P"
if not defined PYEXE if exist "%DOCS%\ai-assets" for /f "delims=" %%F in ('dir /s /b "%DOCS%\ai-assets\python.exe" 2^>nul') do if not defined PYEXE set "PYEXE=%%F"
if not defined PYEXE (
  where py >nul 2>nul
  if not errorlevel 1 ( set "PYEXE=py" & set "PYARG=-3" )
)
if not defined PYEXE (
  where python >nul 2>nul
  if not errorlevel 1 set "PYEXE=python"
)
if not defined PYEXE (
  echo.
  echo  Python not found. Put this folder next to ComfyUI or install Python 3 from python.org
  echo.
  pause
  exit /b 1
)
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
chcp 65001 >nul
echo Python: "%PYEXE%" %PYARG%
"%PYEXE%" %PYARG% "%~dp0kit.py" %*
echo.
pause
