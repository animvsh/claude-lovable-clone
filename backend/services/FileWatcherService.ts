/**
 * File Watcher Service for Live Preview
 * 
 * Manages file watching across multiple project directories and provides
 * real-time updates via WebSocket connections.
 */

import type { Runtime, FileWatcher, FileChange, WSConnection } from "../runtime/types.ts";
import { logger } from "../utils/logger.ts";
import path from "node:path";

export interface WatchSession {
  id: string;
  projectPath: string;
  websocket: WSConnection;
  watcher: FileWatcher;
  lastBuild?: Date;
}

export class FileWatcherService {
  private sessions = new Map<string, WatchSession>();
  private runtime: Runtime;

  // File patterns to watch for changes
  private watchPatterns = [
    /\.(js|jsx|ts|tsx|html|css|scss|sass|less|vue|svelte)$/i,
    /\.(json|md|yaml|yml)$/i,
    /package\.json$/i,
    /\.env/i,
  ];

  // Files to ignore
  private ignorePatterns = [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /\.next/,
    /\.nuxt/,
    /\.cache/,
    /coverage/,
    /\.nyc_output/,
  ];

  constructor(runtime: Runtime) {
    this.runtime = runtime;
  }

  /**
   * Start watching a project directory
   */
  async startWatching(sessionId: string, projectPath: string, websocket: WSConnection): Promise<void> {
    try {
      // Stop existing session if any
      await this.stopWatching(sessionId);

      const watcher = this.runtime.createFileWatcher();
      
      // Set up file change handler
      await watcher.watch(projectPath, (change: FileChange) => {
        this.handleFileChange(sessionId, change);
      });

      const session: WatchSession = {
        id: sessionId,
        projectPath,
        websocket,
        watcher,
        lastBuild: new Date(),
      };

      this.sessions.set(sessionId, session);

      // Send initial confirmation
      websocket.send(JSON.stringify({
        type: 'watch_started',
        sessionId,
        projectPath,
        timestamp: Date.now(),
      }));

      logger.app.info("Started file watching for session {sessionId} at {projectPath}", {
        sessionId,
        projectPath,
      });

      // Set up WebSocket close handler
      websocket.on('close', () => {
        this.stopWatching(sessionId);
      });

    } catch (error) {
      logger.app.error("Failed to start file watching for session {sessionId}: {error}", {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      websocket.send(JSON.stringify({
        type: 'watch_error',
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      }));
    }
  }

  /**
   * Stop watching a project directory
   */
  async stopWatching(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.watcher.close();
        this.sessions.delete(sessionId);
        
        logger.app.info("Stopped file watching for session {sessionId}", { sessionId });
      } catch (error) {
        logger.app.error("Error stopping file watcher for session {sessionId}: {error}", {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Handle file change events
   */
  private handleFileChange(sessionId: string, change: FileChange): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Check if file should be ignored
    if (this.shouldIgnoreFile(change.path)) {
      return;
    }

    // Check if file matches watch patterns
    if (!this.shouldWatchFile(change.path)) {
      return;
    }

    const relativePath = path.relative(session.projectPath, change.path);
    
    logger.app.debug("File change detected in session {sessionId}: {path} ({type})", {
      sessionId,
      path: relativePath,
      type: change.type,
    });

    // Send file change event to WebSocket client
    try {
      session.websocket.send(JSON.stringify({
        type: 'file_change',
        sessionId,
        change: {
          ...change,
          path: relativePath,
        },
        timestamp: Date.now(),
      }));

      // Trigger build if needed
      this.triggerBuildIfNeeded(session, change);

    } catch (error) {
      logger.app.error("Failed to send file change event for session {sessionId}: {error}", {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if file should be ignored
   */
  private shouldIgnoreFile(filePath: string): boolean {
    return this.ignorePatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Check if file should be watched
   */
  private shouldWatchFile(filePath: string): boolean {
    return this.watchPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Trigger build process if needed for the file change
   */
  private async triggerBuildIfNeeded(session: WatchSession, change: FileChange): Promise<void> {
    // Debounce builds to avoid too many rapid builds
    const now = new Date();
    if (session.lastBuild && (now.getTime() - session.lastBuild.getTime()) < 1000) {
      return;
    }

    session.lastBuild = now;

    try {
      // Check if project has a build script
      const buildResult = await this.detectAndRunBuild(session.projectPath);
      
      if (buildResult.success) {
        session.websocket.send(JSON.stringify({
          type: 'build_success',
          sessionId: session.id,
          output: buildResult.output,
          timestamp: Date.now(),
        }));
      } else {
        session.websocket.send(JSON.stringify({
          type: 'build_error',
          sessionId: session.id,
          error: buildResult.error,
          timestamp: Date.now(),
        }));
      }

    } catch (error) {
      logger.app.error("Build failed for session {sessionId}: {error}", {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      });

      session.websocket.send(JSON.stringify({
        type: 'build_error',
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      }));
    }
  }

  /**
   * Detect project type and run appropriate build command
   */
  private async detectAndRunBuild(projectPath: string): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      // Try to read package.json first
      const packageJsonResult = await this.runtime.runCommand('cat', [path.join(projectPath, 'package.json')]);
      
      if (packageJsonResult.success) {
        try {
          const packageJson = JSON.parse(packageJsonResult.stdout);
          
          // Check for common build scripts
          const buildScripts = ['build', 'dev', 'start'];
          for (const script of buildScripts) {
            if (packageJson.scripts?.[script]) {
              const buildResult = await this.runtime.runCommand('npm', ['run', script], {
                env: { PWD: projectPath }
              });
              
              return {
                success: buildResult.success,
                output: buildResult.stdout,
                error: buildResult.stderr,
              };
            }
          }
        } catch (e) {
          // Invalid package.json, continue with other detection methods
        }
      }

      // Check for other framework indicators
      // Vite
      const viteConfigResult = await this.runtime.runCommand('ls', [path.join(projectPath, 'vite.config.*')]);
      if (viteConfigResult.success) {
        const buildResult = await this.runtime.runCommand('npx', ['vite', 'build'], {
          env: { PWD: projectPath }
        });
        return {
          success: buildResult.success,
          output: buildResult.stdout,
          error: buildResult.stderr,
        };
      }

      // No build process detected
      return { success: true, output: 'No build process detected' };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Clean up all sessions
   */
  async cleanup(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map(id => this.stopWatching(id)));
  }
}