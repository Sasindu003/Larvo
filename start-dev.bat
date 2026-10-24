@echo off
title Larvo Local Dev Runner

echo ==========================================
echo Starting Larvo Development Environment...
echo ==========================================

:: Check if root node_modules exists
if not exist "node_modules\" (
    echo [INFO] Installing root dependencies...
    call npm install
)

:: Check if server node_modules exists
if not exist "server\node_modules\" (
    echo [INFO] Installing server dependencies...
    cd server
    call npm install
    cd ..
)

:: Check if client node_modules exists
if not exist "client\node_modules\" (
    echo [INFO] Installing client dependencies...
    cd client
    call npm install
    cd ..
)

echo.
echo Launching Server (ts-node-dev) and Client (Vite) in parallel CMD windows...

start "Larvo - Backend Server" cmd /k "cd /d %~dp0server && npm run dev"
start "Larvo - Frontend Client" cmd /k "cd /d %~dp0client && npm run dev"

echo.
echo Both services have been launched!
echo - Server: http://localhost:5000 (or configured PORT)
echo - Client: http://localhost:5173
echo ==========================================
pause
