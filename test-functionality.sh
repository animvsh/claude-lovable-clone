#!/bin/bash

# Test script for Claude Lovable Clone functionality

echo "🧪 Testing Claude Lovable Clone functionality..."

# Test 1: Server health check
echo "1️⃣ Testing server health..."
SERVER_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:8080 -o /dev/null)
if [ "$SERVER_RESPONSE" = "200" ]; then
    echo "✅ Server is responding"
else
    echo "❌ Server not responding (HTTP $SERVER_RESPONSE)"
fi

# Test 2: API endpoints
echo "2️⃣ Testing API endpoints..."
API_PROJECTS=$(curl -s http://localhost:8080/api/projects)
if echo "$API_PROJECTS" | grep -q "projects"; then
    echo "✅ Projects API working"
    echo "   Found: $(echo "$API_PROJECTS" | jq -r '.projects | length') projects"
else
    echo "❌ Projects API failed"
    echo "   Response: $API_PROJECTS"
fi

# Test 3: GitHub API endpoint
echo "3️⃣ Testing GitHub API endpoint..."
GITHUB_STATUS=$(curl -s "http://localhost:8080/api/github/status?projectPath=/tmp")
if echo "$GITHUB_STATUS" | grep -q "isGitRepo"; then
    echo "✅ GitHub API working"
else
    echo "❌ GitHub API failed"
    echo "   Response: $GITHUB_STATUS"
fi

# Test 4: Static file serving
echo "4️⃣ Testing static file serving..."
STATIC_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:8080/assets/index-DFX_Jiql.js -o /dev/null)
if [ "$STATIC_RESPONSE" = "200" ]; then
    echo "✅ Static files serving properly"
else
    echo "❌ Static files not found (HTTP $STATIC_RESPONSE)"
fi

echo ""
echo "🎉 All tests completed!"
echo "💡 Access your app at: http://localhost:8080"