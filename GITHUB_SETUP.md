# GitHub Integration Setup Guide

## 🚀 Quick Setup

1. **Access the GitHub Integration**
   - Open your Claude Lovable Clone at http://localhost:8080
   - Click on the "GitHub" tab in the sidebar

2. **Create a Personal Access Token**
   - Click "Connect with Personal Access Token"
   - Click the link to "Create a GitHub Personal Access Token"
   - In GitHub, create a token with these scopes:
     - `repo` (Full control of private repositories)
     - `user` (Read user profile data)
     - `workflow` (Update GitHub Action workflows)

3. **Connect Your Account**
   - Copy the generated token (starts with `ghp_`)
   - Paste it into the token field in the app
   - Click "Connect"

## 🔧 Features Available

### Repository Management
- **View Repositories**: See all your GitHub repositories
- **Create New Repositories**: Create repos directly from the interface
- **Repository Details**: View description, privacy status, and last update

### Project Synchronization
- **Auto-Sync Projects**: Connect local projects to GitHub repositories
- **Initial Setup**: Automatically initializes Git, adds remote, creates .gitignore
- **Smart Commits**: Auto-commits with Claude Code signatures

### Auto-Commit Features
- **One-Click Commits**: Commit and push changes with custom messages
- **Status Monitoring**: Real-time Git status for each project
- **Branch Management**: Handles main/master branch setup automatically

## 🔐 Security Notes

- Tokens are stored securely in browser localStorage
- All API calls use HTTPS
- Tokens are never logged or exposed in the interface
- You can disconnect and revoke access anytime

## 🛠 Troubleshooting

### "Invalid GitHub token" error
- Ensure your token has the required scopes: `repo`, `user`, `workflow`
- Check that the token hasn't expired
- Verify you copied the complete token

### "Failed to sync project" error
- Ensure the project directory exists and is accessible
- Check that you have write permissions to the project folder
- Verify the repository name doesn't already exist

### Connection issues
- Make sure you have internet connectivity
- Check if GitHub API is accessible (not blocked by firewall)
- Try refreshing the page and reconnecting

## 📝 Example Workflow

1. **Create a new project** using the home interface
2. **Go to GitHub tab** and connect your account
3. **Create a repository** for your project
4. **Sync the project** to automatically set up Git integration
5. **Make changes** to your project files
6. **Auto-commit** changes with descriptive messages

Your projects will now be automatically synchronized with GitHub! 🎉