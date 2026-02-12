#!/bin/bash
# RayDrop Launcher for macOS
# Double-click this file to start RayDrop

set -e

REPO_URL="https://github.com/OlegNyus/RayDrop.git"
INSTALL_DIR="$HOME/RayDrop"
APP_URL="http://localhost:5173"

echo "=== RayDrop Launcher ==="
echo ""

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed."
    echo "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Check Docker is running
if ! docker info &> /dev/null 2>&1; then
    echo "Starting Docker Desktop..."
    open -a Docker
    echo "Waiting for Docker to start..."
    while ! docker info &> /dev/null 2>&1; do
        sleep 2
    done
    echo "Docker is ready."
fi

# Check Git is installed
if ! command -v git &> /dev/null; then
    echo "ERROR: Git is not installed."
    echo "Please install Git from https://git-scm.com/downloads"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Clone or pull the repository
if [ -d "$INSTALL_DIR" ]; then
    echo "Updating RayDrop..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "Downloading RayDrop..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo ""
echo "Building and starting RayDrop..."
docker compose up --build -d

echo ""
echo "RayDrop is running at $APP_URL"
echo "Opening browser..."
sleep 2
open "$APP_URL"

echo ""
echo "To stop RayDrop, run: cd $INSTALL_DIR && docker compose down"
