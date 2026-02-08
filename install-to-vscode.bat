@echo off
echo =========================================
echo Installing SELFIES Extension to VSCode
echo =========================================
echo.

REM Install dependencies
echo Step 1: Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error: npm install failed
    exit /b 1
)
echo [OK] Dependencies installed
echo.

REM Check if vsce is installed
where vsce >nul 2>nul
if %errorlevel% neq 0 (
    echo Step 2: Installing vsce (packaging tool^)...
    call npm install -g @vscode/vsce
    if %errorlevel% neq 0 (
        echo Error: Could not install vsce
        echo Try running as Administrator
        exit /b 1
    )
    echo [OK] vsce installed
) else (
    echo Step 2: vsce already installed
)
echo.

REM Package the extension
echo Step 3: Packaging extension...
call vsce package --allow-missing-repository
if %errorlevel% neq 0 (
    echo Error: Packaging failed
    exit /b 1
)
echo [OK] Extension packaged
echo.

REM Find the .vsix file
for /f "delims=" %%i in ('dir /b /od *.vsix 2^>nul') do set VSIX_FILE=%%i

if "%VSIX_FILE%"=="" (
    echo Error: No .vsix file found
    exit /b 1
)

REM Install to VSCode
echo Step 4: Installing to VSCode...
call code --install-extension "%VSIX_FILE%"
if %errorlevel% neq 0 (
    echo Error: Installation failed
    echo Try manually: Extensions -^> ... -^> Install from VSIX -^> %VSIX_FILE%
    exit /b 1
)
echo [OK] Extension installed
echo.

echo =========================================
echo Installation Complete!
echo =========================================
echo.
echo Next steps:
echo   1. Reload VSCode (Ctrl+Shift+P -^> 'Reload Window'^)
echo   2. Open a .selfies file
echo   3. The preview panel should open automatically
echo.
echo The extension is now installed permanently in VSCode!
echo.
pause
