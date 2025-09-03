#!/bin/bash

# Claude Lovable Clone - Unified Server Startup Script
# This script builds the frontend and starts the unified server

echo "🏗️  Building frontend for production..."
cd frontend
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed"
    exit 1
fi

echo "✅ Frontend build complete"

echo "🚀 Starting unified server (frontend + backend)..."
cd ../backend
npm run dev