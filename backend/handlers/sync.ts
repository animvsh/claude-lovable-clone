import type { Context } from "hono";
import { githubSyncService, SyncConfig } from "../services/githubSync.js";
import { logger } from "../utils/logger.js";

interface InitializeSyncRequest {
  workspaceId: string;
  repositoryUrl: string;
  accessToken: string;
  branch?: string;
  autoCommit?: boolean;
  autoSync?: boolean;
  syncInterval?: number;
  collaborationMode?: boolean;
  commitMessage?: string;
}

interface CommitAndSyncRequest {
  workspaceId: string;
  commitMessage?: string;
}

interface BranchRequest {
  workspaceId: string;
  branchName: string;
}

/**
 * Initialize sync for a workspace
 */
export async function initializeSync(c: Context) {
  try {
    const {
      workspaceId,
      repositoryUrl,
      accessToken,
      branch = 'main',
      autoCommit = true,
      autoSync = true,
      syncInterval = 30,
      collaborationMode = false,
      commitMessage
    }: InitializeSyncRequest = await c.req.json();

    if (!workspaceId || !repositoryUrl || !accessToken) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Get workspace path from workspace storage
    const workspacePath = `/tmp/claude-workspaces/${workspaceId}`;

    const syncConfig: SyncConfig = {
      workspacePath,
      repositoryUrl,
      accessToken,
      branch,
      autoCommit,
      autoSync,
      syncInterval,
      collaborationMode,
      commitMessage
    };

    await githubSyncService.initializeSync(workspaceId, syncConfig);

    return c.json({
      success: true,
      message: "Sync initialized successfully",
      config: {
        workspaceId,
        branch,
        autoCommit,
        autoSync,
        syncInterval,
        collaborationMode
      }
    });

  } catch (error) {
    logger.app.error('Failed to initialize sync:', error);
    return c.json({
      error: "Failed to initialize sync",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * Get sync status for a workspace
 */
export async function getSyncStatus(c: Context) {
  try {
    const workspaceId = c.req.param('workspaceId');

    if (!workspaceId) {
      return c.json({ error: "Workspace ID is required" }, 400);
    }

    const status = githubSyncService.getSyncStatus(workspaceId);

    if (!status) {
      return c.json({ error: "Workspace sync not found" }, 404);
    }

    return c.json({
      success: true,
      status
    });

  } catch (error) {
    logger.app.error('Failed to get sync status:', error);
    return c.json({
      error: "Failed to get sync status",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * Manually commit and sync changes
 */
export async function commitAndSync(c: Context) {
  try {
    const { workspaceId, commitMessage }: CommitAndSyncRequest = await c.req.json();

    if (!workspaceId) {
      return c.json({ error: "Workspace ID is required" }, 400);
    }

    await githubSyncService.commitAndSync(workspaceId, commitMessage);

    return c.json({
      success: true,
      message: "Changes committed and synced successfully"
    });

  } catch (error) {
    logger.app.error('Failed to commit and sync:', error);
    return c.json({
      error: "Failed to commit and sync",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * Sync with remote repository (pull changes)
 */
export async function syncWithRemote(c: Context) {
  try {
    const workspaceId = c.req.param('workspaceId');

    if (!workspaceId) {
      return c.json({ error: "Workspace ID is required" }, 400);
    }

    await githubSyncService.syncWithRemote(workspaceId);

    return c.json({
      success: true,
      message: "Successfully synced with remote repository"
    });

  } catch (error) {
    logger.app.error('Failed to sync with remote:', error);
    return c.json({
      error: "Failed to sync with remote",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * Create a new branch
 */
export async function createBranch(c: Context) {
  try {
    const { workspaceId, branchName }: BranchRequest = await c.req.json();

    if (!workspaceId || !branchName) {
      return c.json({ error: "Workspace ID and branch name are required" }, 400);
    }

    await githubSyncService.createBranch(workspaceId, branchName);

    return c.json({
      success: true,
      message: `Branch '${branchName}' created and switched successfully`
    });

  } catch (error) {
    logger.app.error('Failed to create branch:', error);
    return c.json({
      error: "Failed to create branch",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * Switch to existing branch
 */
export async function switchBranch(c: Context) {
  try {
    const { workspaceId, branchName }: BranchRequest = await c.req.json();

    if (!workspaceId || !branchName) {
      return c.json({ error: "Workspace ID and branch name are required" }, 400);
    }

    await githubSyncService.switchBranch(workspaceId, branchName);

    return c.json({
      success: true,
      message: `Switched to branch '${branchName}' successfully`
    });

  } catch (error) {
    logger.app.error('Failed to switch branch:', error);
    return c.json({
      error: "Failed to switch branch",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * Stop sync for a workspace
 */
export async function stopSync(c: Context) {
  try {
    const workspaceId = c.req.param('workspaceId');

    if (!workspaceId) {
      return c.json({ error: "Workspace ID is required" }, 400);
    }

    await githubSyncService.stopSync(workspaceId);

    return c.json({
      success: true,
      message: "Sync stopped successfully"
    });

  } catch (error) {
    logger.app.error('Failed to stop sync:', error);
    return c.json({
      error: "Failed to stop sync",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * Get list of branches for workspace
 */
export async function getBranches(c: Context) {
  try {
    const workspaceId = c.req.param('workspaceId');

    if (!workspaceId) {
      return c.json({ error: "Workspace ID is required" }, 400);
    }

    const workspacePath = `/tmp/claude-workspaces/${workspaceId}`;
    
    // Get local and remote branches
    const { execSync } = await import("child_process");
    
    const localBranches = execSync('git branch', { cwd: workspacePath, encoding: 'utf-8' })
      .split('\n')
      .map(branch => branch.replace('*', '').trim())
      .filter(branch => branch.length > 0);

    const remoteBranches = execSync('git branch -r', { cwd: workspacePath, encoding: 'utf-8' })
      .split('\n')
      .map(branch => branch.trim().replace('origin/', ''))
      .filter(branch => branch.length > 0 && !branch.includes('HEAD'));

    const currentBranch = execSync('git branch --show-current', { cwd: workspacePath, encoding: 'utf-8' }).trim();

    return c.json({
      success: true,
      branches: {
        current: currentBranch,
        local: localBranches,
        remote: remoteBranches
      }
    });

  } catch (error) {
    logger.app.error('Failed to get branches:', error);
    return c.json({
      error: "Failed to get branches",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}