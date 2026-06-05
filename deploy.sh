#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "================================================="
echo "      Deploying EchoRoute Webhook Proxy Server   "
echo "================================================="

# Get the directory of the deploy.sh script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 1. Build Frontend
echo ""
echo "--- Step 1: Installing frontend dependencies and building assets ---"
cd "$SCRIPT_DIR/frontend"
npm install
npm run build

# 2. Prepare Backend
echo ""
echo "--- Step 2: Installing backend dependencies ---"
cd "$SCRIPT_DIR/backend"
npm install

# 3. Set up PM2 Command
echo ""
echo "--- Step 3: Resolving PM2 Command ---"
if command -v pm2 &> /dev/null
then
    PM2_CMD="pm2"
    echo "✔ Global PM2 detected."
else
    PM2_CMD="npx pm2"
    echo "⚠ Global PM2 not detected. Falling back to npx pm2..."
fi

# 4. Stop existing instance if running
echo ""
echo "--- Step 4: Deleting old process instances if any ---"
$PM2_CMD delete echoroute-webhook-proxy &> /dev/null || true

# 5. Launch with PM2
echo ""
echo "--- Step 5: Starting EchoRoute under PM2 ---"
# Start the server and configure logging to be timestamped
$PM2_CMD start src/server.js --name "echoroute-webhook-proxy" --time

# 6. Show PM2 processes
echo ""
echo "✔ EchoRoute deployed successfully!"
$PM2_CMD list

# 7. Print and tail logs
echo ""
echo "================================================="
echo "         Tailing PM2 Application Logs            "
echo "        (Press Ctrl+C to stop tailing logs)      "
echo "================================================="
$PM2_CMD logs echoroute-webhook-proxy --lines 20
