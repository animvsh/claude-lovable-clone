import type { Context } from "hono";
import { execSync } from "child_process";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.js";

interface SyncRequest {
  projectPath: string;
  repoName: string;
  accessToken: string;
}

interface AutoCommitRequest {
  projectPath: string;
  message: string;
  accessToken: string;
}

/**
 * Initialize a project directory as a Git repository and connect it to GitHub
 */
export async function syncProjectWithGitHub(c: Context) {
  try {
    const { projectPath, repoName, accessToken }: SyncRequest = await c.req.json();

    if (!projectPath || !repoName || !accessToken) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    if (!existsSync(projectPath)) {
      return c.json({ error: "Project path does not exist" }, 404);
    }

    logger.info("github", `Syncing project ${projectPath} with GitHub repo ${repoName}`);

    // Get GitHub user info to construct the repo URL
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userResponse.ok) {
      return c.json({ error: "Invalid GitHub token" }, 401);
    }

    const user = await userResponse.json();
    const repoUrl = `https://github.com/${user.login}/${repoName}.git`;

    try {
      // Change to project directory
      process.chdir(projectPath);

      // Check if it's already a git repository
      const isGitRepo = existsSync(join(projectPath, ".git"));

      if (!isGitRepo) {
        // Initialize git repository
        execSync("git init", { stdio: "pipe" });
        logger.info("github", "Initialized Git repository");
      }

      // Check if remote already exists
      let hasRemote = false;
      try {
        const remotes = execSync("git remote -v", { encoding: "utf8", stdio: "pipe" });
        hasRemote = remotes.includes("origin");
      } catch (err) {
        // No remotes exist yet
        hasRemote = false;
      }

      if (hasRemote) {
        // Update existing remote
        execSync(`git remote set-url origin ${repoUrl}`, { stdio: "pipe" });
        logger.info("github", "Updated Git remote origin");
      } else {
        // Add new remote
        execSync(`git remote add origin ${repoUrl}`, { stdio: "pipe" });
        logger.info("github", "Added Git remote origin");
      }

      // Create or update .gitignore for typical project files
      const gitignoreContent = `
# Dependencies
node_modules/
.pnpm-store/

# Environment variables
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
.vite/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Runtime
*.pid
*.seed
*.pid.lock

# Coverage
coverage/
*.lcov

# Temporary
.tmp/
.cache/
`;

      const gitignorePath = join(projectPath, ".gitignore");
      if (!existsSync(gitignorePath)) {
        writeFileSync(gitignorePath, gitignoreContent.trim());
        logger.info("github", "Created .gitignore file");
      }

      // Stage all files
      execSync("git add .", { stdio: "pipe" });

      // Check if there are any changes to commit
      let hasChanges = false;
      try {
        execSync("git diff --cached --quiet", { stdio: "pipe" });
      } catch (err) {
        hasChanges = true;
      }

      if (hasChanges) {
        // Commit changes
        const commitMessage = "Initial commit - synced with GitHub";
        execSync(`git commit -m "${commitMessage}"`, { stdio: "pipe" });
        logger.info("github", "Committed initial changes");

        // Push to GitHub
        try {
          execSync("git push -u origin main", { stdio: "pipe" });
          logger.info("github", "Pushed to GitHub successfully");
        } catch (pushError) {
          // Try with master branch if main doesn't exist
          try {
            execSync("git branch -M main", { stdio: "pipe" });
            execSync("git push -u origin main", { stdio: "pipe" });
            logger.info("github", "Pushed to GitHub successfully (created main branch)");
          } catch (err) {
            logger.error("github", "Failed to push to GitHub:", err);
            return c.json({ error: "Failed to push to GitHub" }, 500);
          }
        }
      } else {
        // Just set upstream tracking
        try {
          execSync("git push -u origin main", { stdio: "pipe" });
        } catch (err) {
          // Branch might not exist remotely yet
          logger.info("github", "No changes to push, but remote tracking set");
        }
      }

      return c.json({
        success: true,
        message: "Project successfully synced with GitHub",
        repoUrl,
      });

    } catch (gitError) {
      logger.error("github", "Git operation failed:", gitError);
      return c.json({ 
        error: "Failed to sync with GitHub", 
        details: gitError instanceof Error ? gitError.message : String(gitError)
      }, 500);
    }

  } catch (error) {
    logger.error("github", "Sync request failed:", error);
    return c.json(
      { 
        error: "Failed to sync project", 
        details: error instanceof Error ? error.message : String(error)
      }, 
      500
    );
  }
}

/**
 * Auto-commit and push changes in a project directory
 */
export async function autoCommitAndPush(c: Context) {
  try {
    const { projectPath, message, accessToken }: AutoCommitRequest = await c.req.json();

    if (!projectPath || !message || !accessToken) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    if (!existsSync(projectPath)) {
      return c.json({ error: "Project path does not exist" }, 404);
    }

    logger.info("github", `Auto-committing changes in ${projectPath}`);

    try {
      // Change to project directory
      process.chdir(projectPath);

      // Check if it's a git repository
      if (!existsSync(join(projectPath, ".git"))) {
        return c.json({ error: "Not a Git repository" }, 400);
      }

      // Stage all changes
      execSync("git add .", { stdio: "pipe" });

      // Check if there are any changes to commit
      let hasChanges = false;
      try {
        execSync("git diff --cached --quiet", { stdio: "pipe" });
      } catch (err) {
        hasChanges = true;
      }

      if (!hasChanges) {
        return c.json({
          success: true,
          message: "No changes to commit",
        });
      }

      // Commit changes with provided message and Claude signature
      const commitMessage = `${message}

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>`;

      execSync(`git commit -m "${commitMessage}"`, { stdio: "pipe" });
      logger.info("github", "Committed changes");

      // Push to GitHub
      execSync("git push", { stdio: "pipe" });
      logger.info("github", "Pushed to GitHub successfully");

      return c.json({
        success: true,
        message: "Changes committed and pushed successfully",
      });

    } catch (gitError) {
      logger.error("github", "Git operation failed:", gitError);
      return c.json({ 
        error: "Failed to commit and push changes", 
        details: gitError instanceof Error ? gitError.message : String(gitError)
      }, 500);
    }

  } catch (error) {
    logger.error("github", "Auto-commit request failed:", error);
    return c.json(
      { 
        error: "Failed to auto-commit", 
        details: error instanceof Error ? error.message : String(error)
      }, 
      500
    );
  }
}

/**
 * Get Git status for a project directory
 */
export async function getGitStatus(c: Context) {
  try {
    const projectPath = c.req.query("projectPath");

    if (!projectPath) {
      return c.json({ error: "Missing projectPath parameter" }, 400);
    }

    if (!existsSync(projectPath)) {
      return c.json({ error: "Project path does not exist" }, 404);
    }

    try {
      // Change to project directory
      process.chdir(projectPath);

      // Check if it's a git repository
      if (!existsSync(join(projectPath, ".git"))) {
        return c.json({
          isGitRepo: false,
          hasRemote: false,
          hasChanges: false,
        });
      }

      // Get git status
      const statusOutput = execSync("git status --porcelain", { 
        encoding: "utf8", 
        stdio: "pipe" 
      });
      const hasChanges = statusOutput.trim().length > 0;

      // Check for remote
      let hasRemote = false;
      let remoteUrl = null;
      try {
        const remotes = execSync("git remote -v", { encoding: "utf8", stdio: "pipe" });
        hasRemote = remotes.includes("origin");
        if (hasRemote) {
          const remoteMatch = remotes.match(/origin\s+(.+?)\s+\(fetch\)/);
          remoteUrl = remoteMatch ? remoteMatch[1] : null;
        }
      } catch (err) {
        hasRemote = false;
      }

      // Get current branch
      let currentBranch = null;
      try {
        currentBranch = execSync("git branch --show-current", { 
          encoding: "utf8", 
          stdio: "pipe" 
        }).trim();
      } catch (err) {
        // Might be in detached HEAD or no commits yet
      }

      return c.json({
        isGitRepo: true,
        hasRemote,
        remoteUrl,
        hasChanges,
        currentBranch,
        changedFiles: statusOutput.split('\n').filter(line => line.trim()).length,
      });

    } catch (gitError) {
      logger.error("github", "Git status check failed:", gitError);
      return c.json({ 
        error: "Failed to get Git status", 
        details: gitError instanceof Error ? gitError.message : String(gitError)
      }, 500);
    }

  } catch (error) {
    logger.error("github", "Git status request failed:", error);
    return c.json(
      { 
        error: "Failed to get Git status", 
        details: error instanceof Error ? error.message : String(error)
      }, 
      500
    );
  }
}