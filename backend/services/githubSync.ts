import { execSync, spawn, ChildProcess } from "child_process";
import { watch, FSWatcher, existsSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, relative } from "path";
import { logger } from "../utils/logger.js";
import type { Context } from "hono";

export interface SyncConfig {
  workspacePath: string;
  repositoryUrl: string;
  accessToken: string;
  branch: string;
  autoCommit: boolean;
  autoSync: boolean;
  syncInterval: number; // in seconds
  collaborationMode: boolean;
  commitMessage?: string;
}

export interface SyncStatus {
  workspaceId: string;
  isActive: boolean;
  lastSync: string;
  lastCommit: string;
  pendingChanges: number;
  conflictsDetected: boolean;
  syncError?: string;
}

export interface FileChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  timestamp: number;
  content?: string;
}

export class GitHubSyncService {
  private syncConfigs = new Map<string, SyncConfig>();
  private syncStatus = new Map<string, SyncStatus>();
  private watchers = new Map<string, FSWatcher>();
  private syncProcesses = new Map<string, NodeJS.Timeout>();
  private pendingChanges = new Map<string, FileChange[]>();

  /**
   * Initialize sync for a workspace
   */
  async initializeSync(workspaceId: string, config: SyncConfig): Promise<void> {
    try {
      logger.app.info(`Initializing GitHub sync for workspace ${workspaceId}`);
      
      // Validate workspace and git repository
      if (!existsSync(config.workspacePath)) {
        throw new Error(`Workspace path does not exist: ${config.workspacePath}`);
      }

      if (!existsSync(join(config.workspacePath, '.git'))) {
        throw new Error('Workspace is not a Git repository');
      }

      // Configure Git with token authentication
      await this.configureGitAuth(config.workspacePath, config.accessToken);

      // Set up initial sync status
      this.syncStatus.set(workspaceId, {
        workspaceId,
        isActive: true,
        lastSync: new Date().toISOString(),
        lastCommit: await this.getLastCommitHash(config.workspacePath),
        pendingChanges: 0,
        conflictsDetected: false
      });

      // Store sync configuration
      this.syncConfigs.set(workspaceId, config);
      this.pendingChanges.set(workspaceId, []);

      // Start file monitoring if auto-sync is enabled
      if (config.autoSync) {
        await this.startFileWatching(workspaceId, config);
      }

      // Start periodic sync if enabled
      if (config.autoCommit && config.syncInterval > 0) {
        this.startPeriodicSync(workspaceId, config);
      }

      logger.app.info(`GitHub sync initialized for workspace ${workspaceId}`);
    } catch (error) {
      logger.app.error('Failed to initialize GitHub sync:', error);
      throw error;
    }
  }

  /**
   * Start real-time file monitoring
   */
  private async startFileWatching(workspaceId: string, config: SyncConfig): Promise<void> {
    const watcher = watch(config.workspacePath, { recursive: true }, (eventType, filename) => {
      if (!filename || this.shouldIgnoreFile(filename)) return;

      const filePath = join(config.workspacePath, filename);
      const relativePath = relative(config.workspacePath, filePath);

      logger.app.info(`File change detected: ${relativePath} (${eventType})`);

      const change: FileChange = {
        path: relativePath,
        type: eventType === 'rename' ? (existsSync(filePath) ? 'added' : 'deleted') : 'modified',
        timestamp: Date.now(),
        content: existsSync(filePath) ? readFileSync(filePath, 'utf-8') : undefined
      };

      this.addPendingChange(workspaceId, change);

      // Auto-commit if enabled and enough changes accumulated
      if (config.autoCommit && this.shouldAutoCommit(workspaceId)) {
        this.commitAndSync(workspaceId).catch(error => {
          logger.app.error('Auto-commit failed:', error);
        });
      }
    });

    this.watchers.set(workspaceId, watcher);
    logger.app.info(`File watching started for workspace ${workspaceId}`);
  }

  /**
   * Start periodic sync process
   */
  private startPeriodicSync(workspaceId: string, config: SyncConfig): void {
    const interval = setInterval(async () => {
      try {
        await this.syncWithRemote(workspaceId);
      } catch (error) {
        logger.app.error(`Periodic sync failed for workspace ${workspaceId}:`, error);
      }
    }, config.syncInterval * 1000);

    this.syncProcesses.set(workspaceId, interval);
    logger.app.info(`Periodic sync started for workspace ${workspaceId} (${config.syncInterval}s)`);
  }

  /**
   * Commit and sync changes
   */
  async commitAndSync(workspaceId: string, customMessage?: string): Promise<void> {
    const config = this.syncConfigs.get(workspaceId);
    const status = this.syncStatus.get(workspaceId);

    if (!config || !status) {
      throw new Error('Workspace not found or not initialized');
    }

    try {
      logger.app.info(`Starting commit and sync for workspace ${workspaceId}`);

      // Check for pending changes
      const pendingChanges = this.pendingChanges.get(workspaceId) || [];
      if (pendingChanges.length === 0 && !await this.hasUncommittedChanges(config.workspacePath)) {
        logger.app.info('No changes to commit');
        return;
      }

      // Pull latest changes first to avoid conflicts
      await this.pullFromRemote(config.workspacePath, config.branch);

      // Stage all changes
      execSync('git add -A', { cwd: config.workspacePath });

      // Generate commit message
      const commitMessage = customMessage || config.commitMessage || this.generateCommitMessage(pendingChanges);

      // Commit changes
      execSync(`git commit -m "${commitMessage}"`, { cwd: config.workspacePath });

      // Push to remote
      execSync(`git push origin ${config.branch}`, { cwd: config.workspacePath });

      // Update status
      const updatedStatus: SyncStatus = {
        ...status,
        lastSync: new Date().toISOString(),
        lastCommit: await this.getLastCommitHash(config.workspacePath),
        pendingChanges: 0,
        conflictsDetected: false,
        syncError: undefined
      };

      this.syncStatus.set(workspaceId, updatedStatus);
      this.pendingChanges.set(workspaceId, []); // Clear pending changes

      logger.app.info(`Successfully synced workspace ${workspaceId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update status with error
      if (status) {
        this.syncStatus.set(workspaceId, {
          ...status,
          syncError: errorMessage,
          conflictsDetected: errorMessage.includes('conflict')
        });
      }

      logger.app.error(`Sync failed for workspace ${workspaceId}:`, error);
      throw error;
    }
  }

  /**
   * Sync with remote repository (pull changes)
   */
  async syncWithRemote(workspaceId: string): Promise<void> {
    const config = this.syncConfigs.get(workspaceId);
    
    if (!config) {
      throw new Error('Workspace not found');
    }

    try {
      logger.app.info(`Syncing workspace ${workspaceId} with remote`);

      // Fetch latest changes
      execSync('git fetch origin', { cwd: config.workspacePath });

      // Check if remote has new commits
      const localCommit = await this.getLastCommitHash(config.workspacePath);
      const remoteCommit = await this.getRemoteCommitHash(config.workspacePath, config.branch);

      if (localCommit !== remoteCommit) {
        logger.app.info(`Remote changes detected for workspace ${workspaceId}`);
        
        // Pull changes
        await this.pullFromRemote(config.workspacePath, config.branch);
        
        // Update sync status
        const status = this.syncStatus.get(workspaceId);
        if (status) {
          this.syncStatus.set(workspaceId, {
            ...status,
            lastSync: new Date().toISOString(),
            lastCommit: remoteCommit
          });
        }

        logger.app.info(`Successfully pulled remote changes for workspace ${workspaceId}`);
      }
    } catch (error) {
      logger.app.error(`Failed to sync with remote for workspace ${workspaceId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new branch for feature development
   */
  async createBranch(workspaceId: string, branchName: string): Promise<void> {
    const config = this.syncConfigs.get(workspaceId);
    
    if (!config) {
      throw new Error('Workspace not found');
    }

    try {
      // Create and switch to new branch
      execSync(`git checkout -b ${branchName}`, { cwd: config.workspacePath });
      
      // Push new branch to remote
      execSync(`git push -u origin ${branchName}`, { cwd: config.workspacePath });
      
      // Update config to use new branch
      config.branch = branchName;
      this.syncConfigs.set(workspaceId, config);

      logger.app.info(`Created and switched to branch ${branchName} for workspace ${workspaceId}`);
    } catch (error) {
      logger.app.error(`Failed to create branch ${branchName}:`, error);
      throw error;
    }
  }

  /**
   * Switch to existing branch
   */
  async switchBranch(workspaceId: string, branchName: string): Promise<void> {
    const config = this.syncConfigs.get(workspaceId);
    
    if (!config) {
      throw new Error('Workspace not found');
    }

    try {
      // Switch to branch
      execSync(`git checkout ${branchName}`, { cwd: config.workspacePath });
      
      // Update config
      config.branch = branchName;
      this.syncConfigs.set(workspaceId, config);

      logger.app.info(`Switched to branch ${branchName} for workspace ${workspaceId}`);
    } catch (error) {
      logger.app.error(`Failed to switch to branch ${branchName}:`, error);
      throw error;
    }
  }

  /**
   * Get sync status for workspace
   */
  getSyncStatus(workspaceId: string): SyncStatus | null {
    return this.syncStatus.get(workspaceId) || null;
  }

  /**
   * Stop sync for workspace
   */
  async stopSync(workspaceId: string): Promise<void> {
    logger.app.info(`Stopping sync for workspace ${workspaceId}`);

    // Stop file watcher
    const watcher = this.watchers.get(workspaceId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(workspaceId);
    }

    // Stop periodic sync
    const syncProcess = this.syncProcesses.get(workspaceId);
    if (syncProcess) {
      clearInterval(syncProcess);
      this.syncProcesses.delete(workspaceId);
    }

    // Update status
    const status = this.syncStatus.get(workspaceId);
    if (status) {
      this.syncStatus.set(workspaceId, { ...status, isActive: false });
    }

    logger.app.info(`Sync stopped for workspace ${workspaceId}`);
  }

  // Private helper methods

  private async configureGitAuth(workspacePath: string, accessToken: string): Promise<void> {
    // Configure Git to use token authentication
    execSync(`git config credential.helper store`, { cwd: workspacePath });
    
    // Set up token authentication for this repository
    const gitConfig = join(workspacePath, '.git', 'config');
    const configContent = readFileSync(gitConfig, 'utf-8');
    
    // Update remote URL to include token
    const updatedConfig = configContent.replace(
      /url = https:\/\/github\.com\//g,
      `url = https://${accessToken}@github.com/`
    );
    
    writeFileSync(gitConfig, updatedConfig);
  }

  private shouldIgnoreFile(filename: string): boolean {
    const ignorePatterns = [
      '.git/', 'node_modules/', '.DS_Store', '*.log', 
      '.tmp', '.cache', 'dist/', 'build/'
    ];
    
    return ignorePatterns.some(pattern => 
      filename.includes(pattern.replace('*', '')) || filename.endsWith(pattern.replace('*.', '.'))
    );
  }

  private addPendingChange(workspaceId: string, change: FileChange): void {
    const changes = this.pendingChanges.get(workspaceId) || [];
    changes.push(change);
    this.pendingChanges.set(workspaceId, changes);

    // Update pending changes count in status
    const status = this.syncStatus.get(workspaceId);
    if (status) {
      this.syncStatus.set(workspaceId, { ...status, pendingChanges: changes.length });
    }
  }

  private shouldAutoCommit(workspaceId: string): boolean {
    const changes = this.pendingChanges.get(workspaceId) || [];
    return changes.length >= 5; // Auto-commit after 5 changes
  }

  private async hasUncommittedChanges(workspacePath: string): Promise<boolean> {
    try {
      const status = execSync('git status --porcelain', { cwd: workspacePath, encoding: 'utf-8' });
      return status.trim().length > 0;
    } catch {
      return false;
    }
  }

  private async getLastCommitHash(workspacePath: string): Promise<string> {
    try {
      return execSync('git rev-parse HEAD', { cwd: workspacePath, encoding: 'utf-8' }).trim();
    } catch {
      return '';
    }
  }

  private async getRemoteCommitHash(workspacePath: string, branch: string): Promise<string> {
    try {
      return execSync(`git rev-parse origin/${branch}`, { cwd: workspacePath, encoding: 'utf-8' }).trim();
    } catch {
      return '';
    }
  }

  private async pullFromRemote(workspacePath: string, branch: string): Promise<void> {
    try {
      execSync(`git pull origin ${branch}`, { cwd: workspacePath });
    } catch (error) {
      // Handle merge conflicts
      if (error instanceof Error && error.message.includes('conflict')) {
        logger.app.warn('Merge conflicts detected during pull');
        throw new Error('Merge conflicts detected. Manual resolution required.');
      }
      throw error;
    }
  }

  private generateCommitMessage(changes: FileChange[]): string {
    const addedCount = changes.filter(c => c.type === 'added').length;
    const modifiedCount = changes.filter(c => c.type === 'modified').length;
    const deletedCount = changes.filter(c => c.type === 'deleted').length;

    const parts = [];
    if (addedCount > 0) parts.push(`${addedCount} added`);
    if (modifiedCount > 0) parts.push(`${modifiedCount} modified`);
    if (deletedCount > 0) parts.push(`${deletedCount} deleted`);

    const summary = parts.join(', ');
    const timestamp = new Date().toLocaleString();
    
    return `Auto-sync: ${summary} (${timestamp})

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>`;
  }
}

// Global sync service instance
export const githubSyncService = new GitHubSyncService();