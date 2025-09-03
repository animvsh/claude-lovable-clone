import type { Context } from "hono";
import { execSync } from "child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.js";

interface CloneAndInitializeRequest {
  repositoryUrl: string;
  repositoryName: string;
  branch?: string;
  accessToken: string;
}

interface Workspace {
  id: string;
  repositoryUrl: string;
  repositoryName: string;
  localPath: string;
  branch: string;
  status: 'cloning' | 'ready' | 'active' | 'error';
  createdAt: string;
  claudeSessionId?: string;
}

// In-memory workspace storage (in production, use a database)
const activeWorkspaces = new Map<string, Workspace>();

// Base workspace directory
const WORKSPACES_DIR = process.env.WORKSPACES_DIR || '/tmp/claude-workspaces';

// Ensure workspaces directory exists
if (!existsSync(WORKSPACES_DIR)) {
  mkdirSync(WORKSPACES_DIR, { recursive: true });
}

/**
 * Clone a GitHub repository and initialize it for Claude development
 */
export async function cloneAndInitialize(c: Context) {
  try {
    const { repositoryUrl, repositoryName, branch = 'main', accessToken }: CloneAndInitializeRequest = await c.req.json();

    if (!repositoryUrl || !repositoryName || !accessToken) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Generate unique workspace ID
    const timestamp = Date.now();
    const workspaceId = `${repositoryName}-${timestamp}`;
    const workspacePath = join(WORKSPACES_DIR, workspaceId);

    logger.app.info(`Creating workspace for ${repositoryName} at ${workspacePath}`);

    // Create workspace entry
    const workspace: Workspace = {
      id: workspaceId,
      repositoryUrl,
      repositoryName,
      localPath: workspacePath,
      branch,
      status: 'cloning',
      createdAt: new Date().toISOString()
    };

    activeWorkspaces.set(workspaceId, workspace);

    try {
      // Create workspace directory
      if (!existsSync(workspacePath)) {
        mkdirSync(workspacePath, { recursive: true });
      }

      // Prepare authenticated repository URL
      const urlParts = repositoryUrl.replace('https://', '').split('/');
      const authenticatedUrl = `https://${accessToken}@${urlParts.join('/')}`;

      // Clone repository
      logger.app.info(`Cloning repository ${repositoryUrl}`);
      try {
        // Try to clone with specified branch
        execSync(`git clone --branch ${branch} ${authenticatedUrl} .`, {
          cwd: workspacePath,
          stdio: 'pipe'
        });
      } catch (branchError) {
        // If branch doesn't exist, try common default branches
        const defaultBranches = ['main', 'master'];
        let cloned = false;
        
        for (const defaultBranch of defaultBranches) {
          if (defaultBranch === branch) continue; // Skip the one we already tried
          
          try {
            // Clean up the directory first
            if (existsSync(workspacePath)) {
              rmSync(workspacePath, { recursive: true, force: true });
              mkdirSync(workspacePath, { recursive: true });
            }
            
            execSync(`git clone --branch ${defaultBranch} ${authenticatedUrl} .`, {
              cwd: workspacePath,
              stdio: 'pipe'
            });
            
            // Update the branch in workspace
            workspace.branch = defaultBranch;
            cloned = true;
            logger.app.info(`Successfully cloned with default branch: ${defaultBranch}`);
            break;
          } catch (err) {
            continue; // Try next branch
          }
        }
        
        if (!cloned) {
          // If no default branch works, try cloning without specifying branch
          try {
            if (existsSync(workspacePath)) {
              rmSync(workspacePath, { recursive: true, force: true });
              mkdirSync(workspacePath, { recursive: true });
            }
            
            execSync(`git clone ${authenticatedUrl} .`, {
              cwd: workspacePath,
              stdio: 'pipe'
            });
            
            // Get the actual default branch
            const actualBranch = execSync('git branch --show-current', {
              cwd: workspacePath,
              encoding: 'utf8',
              stdio: 'pipe'
            }).trim();
            
            workspace.branch = actualBranch || 'main';
            logger.app.info(`Successfully cloned, detected branch: ${workspace.branch}`);
          } catch (finalError) {
            throw branchError; // Throw the original error
          }
        }
      }

      // Remove the token from git remote for security
      execSync(`git remote set-url origin ${repositoryUrl}`, {
        cwd: workspacePath,
        stdio: 'pipe'
      });

      // Create Claude workspace configuration
      const claudeConfig = {
        repository: repositoryName,
        workspaceId,
        initializedAt: new Date().toISOString(),
        branch
      };

      writeFileSync(
        join(workspacePath, '.claude-workspace'),
        JSON.stringify(claudeConfig, null, 2)
      );

      // Update workspace status
      workspace.status = 'ready';
      activeWorkspaces.set(workspaceId, workspace);

      logger.app.info(`Successfully initialized workspace ${workspaceId}`);

      return c.json({
        success: true,
        workspace: {
          id: workspace.id,
          repositoryName: workspace.repositoryName,
          localPath: workspace.localPath,
          branch: workspace.branch,
          status: workspace.status
        }
      });

    } catch (cloneError) {
      workspace.status = 'error';
      activeWorkspaces.set(workspaceId, workspace);
      
      logger.app.error("Failed to clone repository:", cloneError);
      return c.json({ 
        error: "Failed to clone repository", 
        details: cloneError instanceof Error ? cloneError.message : String(cloneError)
      }, 500);
    }

  } catch (error) {
    logger.app.error("Clone and initialize request failed:", error);
    return c.json(
      { 
        error: "Failed to process request", 
        details: error instanceof Error ? error.message : String(error)
      }, 
      500
    );
  }
}

/**
 * Get all active workspaces
 */
export async function getWorkspaces(c: Context) {
  try {
    const workspaces = Array.from(activeWorkspaces.values()).map(workspace => ({
      id: workspace.id,
      repositoryName: workspace.repositoryName,
      repositoryUrl: workspace.repositoryUrl,
      localPath: workspace.localPath,
      branch: workspace.branch,
      status: workspace.status,
      createdAt: workspace.createdAt,
      claudeSessionId: workspace.claudeSessionId
    }));

    return c.json({ workspaces });
  } catch (error) {
    logger.app.error("Failed to get workspaces:", error);
    return c.json({ error: "Failed to get workspaces" }, 500);
  }
}

/**
 * Initialize Claude development environment for a workspace
 */
export async function initializeClaudeEnvironment(c: Context) {
  try {
    const { workspaceId } = c.req.param();

    if (!workspaceId || !activeWorkspaces.has(workspaceId)) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    const workspace = activeWorkspaces.get(workspaceId)!;

    if (workspace.status !== 'ready' && workspace.status !== 'active') {
      return c.json({ error: "Workspace not ready for Claude initialization" }, 400);
    }

    // Generate Claude session ID (this would integrate with your existing Claude session management)
    const claudeSessionId = `claude-${workspaceId}-${Date.now()}`;
    
    workspace.claudeSessionId = claudeSessionId;
    workspace.status = 'active';
    activeWorkspaces.set(workspaceId, workspace);

    logger.app.info(`Initialized Claude environment for workspace ${workspaceId}`);

    return c.json({
      success: true,
      claudeSessionId,
      workspacePath: workspace.localPath
    });

  } catch (error) {
    logger.app.error("Failed to initialize Claude environment:", error);
    return c.json({ error: "Failed to initialize Claude environment" }, 500);
  }
}

/**
 * Delete a workspace and clean up files
 */
export async function deleteWorkspace(c: Context) {
  try {
    const { workspaceId } = c.req.param();

    if (!workspaceId || !activeWorkspaces.has(workspaceId)) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    const workspace = activeWorkspaces.get(workspaceId)!;

    // Clean up workspace directory
    if (existsSync(workspace.localPath)) {
      rmSync(workspace.localPath, { recursive: true, force: true });
    }

    // Remove from active workspaces
    activeWorkspaces.delete(workspaceId);

    logger.app.info(`Deleted workspace ${workspaceId}`);

    return c.json({ success: true, message: "Workspace deleted successfully" });

  } catch (error) {
    logger.app.error("Failed to delete workspace:", error);
    return c.json({ error: "Failed to delete workspace" }, 500);
  }
}

/**
 * Get workspace status and details
 */
export async function getWorkspaceStatus(c: Context) {
  try {
    const { workspaceId } = c.req.param();

    if (!workspaceId || !activeWorkspaces.has(workspaceId)) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    const workspace = activeWorkspaces.get(workspaceId)!;

    // Check if workspace directory still exists
    const directoryExists = existsSync(workspace.localPath);
    if (!directoryExists && workspace.status !== 'error') {
      workspace.status = 'error';
      activeWorkspaces.set(workspaceId, workspace);
    }

    return c.json({
      id: workspace.id,
      repositoryName: workspace.repositoryName,
      repositoryUrl: workspace.repositoryUrl,
      localPath: workspace.localPath,
      branch: workspace.branch,
      status: workspace.status,
      createdAt: workspace.createdAt,
      claudeSessionId: workspace.claudeSessionId,
      directoryExists
    });

  } catch (error) {
    logger.app.error("Failed to get workspace status:", error);
    return c.json({ error: "Failed to get workspace status" }, 500);
  }
}