#!/bin/bash

echo "🚀 Deploying Trading Bot Backend to Railway..."

# Check if we're in the backend directory
if [ ! -f "server.js" ]; then
    echo "❌ Error: server.js not found. Please run this script from the backend directory."
    exit 1
fi

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login to Railway (this will open a browser)
echo "🔐 Logging into Railway..."
railway login

# Link to existing project or create new one
echo "🔗 Linking to Railway project..."
railway link

# Deploy the application
echo "🚀 Deploying to Railway..."
railway up

echo "✅ Deployment complete!"
echo "🌐 Your backend should be available at: https://responsible-luck-production.up.railway.app"
echo "🔍 Check the health endpoint: https://responsible-luck-production.up.railway.app/health"
