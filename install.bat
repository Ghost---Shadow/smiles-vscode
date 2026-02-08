@echo off
echo =========================================
echo SELFIES VSCode Extension - Installation
echo =========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo Node.js version: %NODE_VERSION%
echo.

REM Check if selfies-js exists
if not exist "..\selfies-js" (
    echo Error: selfies-js package not found in parent directory
    echo Please ensure selfies-js is installed at ..\selfies-js
    exit /b 1
)

echo [OK] Found selfies-js package
echo.

REM Install dependencies
echo Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo Error: npm install failed
    exit /b 1
)

echo.
echo [OK] Dependencies installed
echo.

REM Run build script
echo Building extension...
node build.js

if %errorlevel% neq 0 (
    echo Error: Build failed
    exit /b 1
)

echo.
echo =========================================
echo Installation complete!
echo =========================================
echo.
echo To test the extension:
echo   1. Open this folder in VS Code
echo   2. Press F5 to launch Extension Development Host
echo   3. Open example.selfies to test
echo.
echo For more information, see SETUP.md
echo.
pause
