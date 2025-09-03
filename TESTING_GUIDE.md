# Testing Guide - GitHub-First Development Workflow

## 🚀 Complete GitHub-First Workflow Testing

### Prerequisites
1. **Claude API Key**: Make sure you have a Claude API key set up for Claude Code to work
2. **GitHub Personal Access Token**: Create a token with `repo`, `user`, `workflow` scopes
3. **Application Running**: Both backend and frontend running on http://localhost:8080

### Step-by-Step Testing Process

#### 1. Access the Application
- Open http://localhost:8080 in your browser
- Should see the Claude Dev Studio home screen

#### 2. Connect to GitHub
- Click "Projects" in the sidebar (should prompt GitHub connection if not authenticated)
- Or click "GitHub" in the sidebar
- Click "Connect with Personal Access Token"
- Create token at: https://github.com/settings/tokens/new?scopes=repo,user,workflow
- Paste token and click "Connect"
- Should see your GitHub user profile and repositories

#### 3. Browse Repositories
- Click "Projects" tab to see GitHub repository browser
- Should display all your repositories with:
  - Repository name and description
  - Programming language with color indicator
  - Stars and watchers count
  - Last updated time
  - "Start Developing" button for each repo

#### 4. Start Development (The Magic Moment!)
- Click "Start Developing" on any repository
- Should see the workspace initializer with 3 steps:
  1. **Clone repository**: Downloads repo to local workspace
  2. **Setup workspace**: Prepares development environment
  3. **Initialize Claude**: Sets up Claude Code integration
- Each step should show progress and complete successfully

#### 5. Development Environment
- After initialization completes, should automatically navigate to Claude development interface
- Should be in the project directory with all files accessible
- Claude should have full context of the repository

### Backend API Testing

#### Test Workspace Creation
```bash
curl -X POST http://localhost:8080/api/workspaces/clone-and-initialize \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryUrl": "https://github.com/octocat/Hello-World.git",
    "repositoryName": "Hello-World",
    "branch": "master",
    "accessToken": "your_github_token"
  }'
```

#### Test Workspace Status
```bash
curl http://localhost:8080/api/workspaces
```

#### Test Claude Initialization
```bash
curl -X POST http://localhost:8080/api/workspaces/{workspace-id}/initialize-claude
```

### Expected Results

#### ✅ Success Indicators
- **Authentication**: GitHub user profile displayed
- **Repository List**: All repos shown with metadata
- **Workspace Creation**: Repository cloned successfully to `/tmp/claude-workspaces/`
- **Claude Integration**: Session ID generated and development environment active
- **File Access**: Can see and interact with all repository files
- **Git Integration**: Repository history and branches accessible

#### ❌ Common Issues and Solutions

**"Invalid GitHub token"**
- Check token has correct scopes: `repo`, `user`, `workflow`
- Ensure token hasn't expired
- Verify token is copied completely

**"Failed to clone repository"**
- Check repository exists and is accessible
- Verify token has access to private repositories if needed
- Ensure stable internet connection

**"Claude Code process exited with code 1"**
- Check Claude API key is configured
- Verify workspace directory permissions
- Check Claude Code version compatibility

**Workspace initialization hangs**
- Check backend logs for specific errors
- Verify workspace directory is writable
- Ensure no firewall blocking repository access

### Performance Benchmarks

**Target Performance**:
- Repository list load: < 3 seconds
- Repository cloning: < 10 seconds for small repos
- Claude initialization: < 5 seconds
- Total time from "Start Developing" to active coding: < 20 seconds

### Test Repositories

**Good Test Repositories**:
- `octocat/Hello-World` - Simple, small repository
- `microsoft/vscode` - Large, complex repository (test performance)
- Your own small projects - Test with private repositories

**Repository Variations to Test**:
- Public vs Private repositories
- Different default branches (main vs master)
- Different programming languages
- Large vs small repositories
- Repositories with/without README files

### Integration Testing Checklist

- [ ] GitHub authentication works
- [ ] Repository listing displays correctly
- [ ] Repository search and filtering functional
- [ ] Workspace cloning completes successfully
- [ ] Claude environment initializes properly
- [ ] Development interface loads with repository context
- [ ] File editing and navigation works
- [ ] Git operations function correctly
- [ ] Multiple workspaces can be created
- [ ] Workspace cleanup works properly

### Troubleshooting Commands

```bash
# Check workspace directories
ls -la /tmp/claude-workspaces/

# Check workspace contents
ls -la /tmp/claude-workspaces/{workspace-name}/

# Check git status in workspace
cd /tmp/claude-workspaces/{workspace-name} && git status

# Test Claude CLI directly
cd /tmp/claude-workspaces/{workspace-name} && claude --version

# Check backend logs
# Look at the running backend process logs for error details
```

## 🎯 Success Criteria

The GitHub-first workflow is fully functional when:

1. **One-Click Development**: Click "Start Developing" → Automatic environment setup → Ready to code
2. **No Manual Setup**: Zero configuration or directory selection required
3. **GitHub Integration**: All projects sourced from GitHub repositories
4. **Claude Context**: Full repository context available to Claude immediately
5. **Error Resilience**: Graceful handling of network issues, permissions, etc.

This testing guide ensures the complete GitHub-first development workflow is robust and user-friendly! 🚀