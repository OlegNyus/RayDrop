@echo off
REM RayDrop Launcher for Windows
REM Double-click this file to start RayDrop

set REPO_URL=https://github.com/OlegNyus/RayDrop.git
set INSTALL_DIR=%USERPROFILE%\RayDrop
set APP_URL=http://localhost:5173

echo === RayDrop Launcher ===
echo.

REM Check Docker is installed
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed.
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

REM Check Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Waiting for Docker to start...
    :wait_docker
    timeout /t 2 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 goto wait_docker
    echo Docker is ready.
)

REM Check Git is installed
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Git is not installed.
    echo Please install Git from https://git-scm.com/downloads
    echo.
    pause
    exit /b 1
)

REM Clone or pull the repository
if exist "%INSTALL_DIR%" (
    echo Updating RayDrop...
    cd /d "%INSTALL_DIR%"
    git pull
) else (
    echo Downloading RayDrop...
    git clone %REPO_URL% "%INSTALL_DIR%"
    cd /d "%INSTALL_DIR%"
)

echo.
echo Building and starting RayDrop...
docker compose up --build -d

echo.
echo RayDrop is running at %APP_URL%
echo Opening browser...
timeout /t 2 /nobreak >nul
start %APP_URL%

echo.
echo To stop RayDrop, run: cd %INSTALL_DIR% ^&^& docker compose down
echo.
pause
