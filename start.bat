@echo off
SETLOCAL ENABLEDELAYEDEXPANSION
TITLE NeoTavern Frontend
CLS

ECHO ===================================================
ECHO   NeoTavern Frontend
ECHO ===================================================
ECHO.

:: 1. Ensure dependencies match package.json
SET PKG_HASH_FILE=node_modules\.package-json.hash
SET NEED_INSTALL=0
SET LAST_PKG_HASH=none
SET CURRENT_PKG_HASH=
FOR /F "usebackq delims=" %%H IN (`node -p "require('crypto').createHash('sha256').update(require('fs').readFileSync('package.json')).digest('hex')"`) DO (
    SET CURRENT_PKG_HASH=%%H
)

IF EXIST "%PKG_HASH_FILE%" (
    SET /P LAST_PKG_HASH=<"%PKG_HASH_FILE%"
)

IF NOT EXIST "node_modules" (
    ECHO [1/3] First run detected. Installing dependencies...
    SET NEED_INSTALL=1
) ELSE IF NOT EXIST "%PKG_HASH_FILE%" (
    ECHO [1/3] Dependency hash missing. Reinstalling dependencies...
    SET NEED_INSTALL=1
) ELSE IF "!CURRENT_PKG_HASH!" NEQ "!LAST_PKG_HASH!" (
    ECHO [1/3] package.json changed. Reinstalling dependencies...
    SET NEED_INSTALL=1
) ELSE (
    ECHO [1/3] Dependencies up-to-date.
)

IF "!NEED_INSTALL!"=="1" (
    call npm ci
    IF !ERRORLEVEL! NEQ 0 (
        ECHO Error installing dependencies.
        PAUSE
        EXIT /B
    )
    >"%PKG_HASH_FILE%" ECHO !CURRENT_PKG_HASH!
)

:: 2. Determine if Build is Needed
SET NEED_BUILD=0

:: Rule A: If dist folder or index.html is missing, we must build
IF NOT EXIST "dist\index.html" SET NEED_BUILD=1

:: Rule B: If user typed "rebuild" argument
IF "%1"=="rebuild" SET NEED_BUILD=1

:: Rule C: Check Git Hash vs Last Build Hash
SET CURRENT_HASH=unknown
SET LAST_BUILD_HASH=none

:: safely check for git repo
IF EXIST ".git\HEAD" (
    FOR /F "tokens=*" %%g IN ('git rev-parse HEAD 2^>nul') do (SET CURRENT_HASH=%%g)
)

:: safely check for last build version
IF EXIST "dist\version.txt" (
    SET /P LAST_BUILD_HASH=<dist\version.txt
)

:: Compare hashes only if we found a git hash
IF "!CURRENT_HASH!" NEQ "unknown" (
    IF "!CURRENT_HASH!" NEQ "!LAST_BUILD_HASH!" (
        ECHO [2/3] Update detected ^(Hash mismatch^).
        SET NEED_BUILD=1
    )
)

:: Decide Action
IF "!NEED_BUILD!"=="1" (
    GOTO BUILD
) ELSE (
    ECHO [2/3] No updates detected. Skipping build.
    GOTO PREVIEW
)

:BUILD
ECHO [2/3] Building application...
call npm run build:deploy
IF !ERRORLEVEL! NEQ 0 (
    ECHO Error building the application.
    PAUSE
    EXIT /B
)
:: Save the new hash
IF "!CURRENT_HASH!" NEQ "unknown" (
    ECHO !CURRENT_HASH!> dist\version.txt
)

:PREVIEW
:: 3. Launch the Preview Server
ECHO [3/3] Starting server...
ECHO.
ECHO App should be running at: http://localhost:4173
ECHO Press Ctrl+C to stop.
ECHO.

call npm run preview
PAUSE