#!/bin/bash

# Test script for GitHub-first development workflow
# This script tests the complete end-to-end functionality

echo "🚀 Testing GitHub-First Development Workflow"
echo "=============================================="

BASE_URL="http://localhost:8080"

# Test 1: Workspace API availability
echo "📡 Testing workspace API endpoints..."
curl -s "$BASE_URL/api/workspaces" > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Workspace API is responding"
else
    echo "❌ Workspace API is not responding"
    exit 1
fi

# Test 2: Error handling with invalid repository
echo "🔍 Testing error handling..."
INVALID_RESPONSE=$(curl -s -X POST "$BASE_URL/api/workspaces/clone-and-initialize" \
    -H "Content-Type: application/json" \
    -d '{
        "repositoryUrl": "https://github.com/invalid/repo.git",
        "repositoryName": "invalid-repo",
        "branch": "main",
        "accessToken": "invalid_token"
    }')

if echo "$INVALID_RESPONSE" | grep -q "error"; then
    echo "✅ Error handling works correctly"
else
    echo "❌ Error handling failed"
    exit 1
fi

# Test 3: Valid public repository cloning
echo "📦 Testing repository cloning..."
CLONE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/workspaces/clone-and-initialize" \
    -H "Content-Type: application/json" \
    -d '{
        "repositoryUrl": "https://github.com/octocat/Hello-World.git",
        "repositoryName": "Hello-World-Test",
        "branch": "master",
        "accessToken": "test_token"
    }')

WORKSPACE_ID=$(echo "$CLONE_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if echo "$CLONE_RESPONSE" | grep -q "success.*true"; then
    echo "✅ Repository cloning successful"
else
    echo "❌ Repository cloning failed"
    echo "Response: $CLONE_RESPONSE"
    exit 1
fi

# Test 4: Claude environment initialization
echo "🧠 Testing Claude initialization..."
if [ -n "$WORKSPACE_ID" ]; then
    CLAUDE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/workspaces/$WORKSPACE_ID/initialize-claude")
    
    if echo "$CLAUDE_RESPONSE" | grep -q "success.*true"; then
        echo "✅ Claude initialization successful"
    else
        echo "❌ Claude initialization failed"
        echo "Response: $CLAUDE_RESPONSE"
        exit 1
    fi
else
    echo "❌ No workspace ID found for Claude initialization"
    exit 1
fi

# Test 5: Workspace directory validation
echo "📁 Testing workspace directory..."
WORKSPACE_PATH="/tmp/claude-workspaces/$WORKSPACE_ID"
if [ -d "$WORKSPACE_PATH" ]; then
    echo "✅ Workspace directory exists"
    
    # Check for git repository
    if [ -d "$WORKSPACE_PATH/.git" ]; then
        echo "✅ Git repository cloned successfully"
    else
        echo "❌ Git repository not found"
        exit 1
    fi
    
    # Check for Claude workspace config
    if [ -f "$WORKSPACE_PATH/.claude-workspace" ]; then
        echo "✅ Claude workspace configuration created"
    else
        echo "❌ Claude workspace configuration missing"
        exit 1
    fi
else
    echo "❌ Workspace directory not found"
    exit 1
fi

# Test 6: Workspace listing
echo "📋 Testing workspace listing..."
WORKSPACES_RESPONSE=$(curl -s "$BASE_URL/api/workspaces")
if echo "$WORKSPACES_RESPONSE" | grep -q "$WORKSPACE_ID"; then
    echo "✅ Workspace appears in listing"
else
    echo "❌ Workspace not found in listing"
    exit 1
fi

# Test 7: Frontend accessibility
echo "🌐 Testing frontend accessibility..."
FRONTEND_URL="http://localhost:3001"
curl -s "$FRONTEND_URL" > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend is not accessible"
    exit 1
fi

echo ""
echo "🎉 All tests passed! GitHub-first workflow is fully functional"
echo ""
echo "📝 Test Summary:"
echo "   ✅ Workspace API endpoints working"
echo "   ✅ Error handling for invalid repositories"
echo "   ✅ Repository cloning functionality"
echo "   ✅ Claude environment initialization"
echo "   ✅ Workspace directory structure"
echo "   ✅ Workspace management and listing"
echo "   ✅ Frontend accessibility"
echo ""
echo "🚀 Ready for production use!"