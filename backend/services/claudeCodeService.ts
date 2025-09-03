import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { logger } from "../utils/logger.js";
import { oauthService } from "./oauthService.js";

export interface ClaudeCodeSession {
  sessionId: string;
  workingDirectory: string;
  process?: ChildProcess;
  isActive: boolean;
  startedAt: Date;
  lastActivity: Date;
  userSessionId: string;
}

export interface ClaudeMessage {
  type: 'system' | 'assistant' | 'result';
  content: any;
  timestamp: string;
  sessionId?: string;
}

export interface ClaudeExecutionOptions {
  workingDirectory: string;
  userSessionId: string;
  command?: string;
  streamOutput?: boolean;
}

export class ClaudeCodeService extends EventEmitter {
  private activeSessions = new Map<string, ClaudeCodeSession>();
  private messageBuffer = new Map<string, ClaudeMessage[]>();

  constructor() {
    super();
    
    // Cleanup inactive sessions every 30 minutes
    setInterval(() => this.cleanupInactiveSessions(), 30 * 60 * 1000);
  }

  /**
   * Start a new Claude Code session using OAuth token
   */
  async startClaudeSession(options: ClaudeExecutionOptions): Promise<string> {
    const { workingDirectory, userSessionId, command } = options;

    // Validate Claude authentication
    const claudeSession = oauthService.getSession(userSessionId);
    if (!claudeSession || claudeSession.provider !== 'claude') {
      throw new Error('Valid Claude authentication required');
    }

    const sessionId = `claude-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.app.info(`Starting Claude Code session: ${sessionId}`);

      // Create session record
      const session: ClaudeCodeSession = {
        sessionId,
        workingDirectory,
        isActive: true,
        startedAt: new Date(),
        lastActivity: new Date(),
        userSessionId
      };

      // Start Claude Code process with OAuth token
      const claudeProcess = this.spawnClaudeProcess(sessionId, workingDirectory, claudeSession.accessToken, command);
      session.process = claudeProcess;

      this.activeSessions.set(sessionId, session);
      this.messageBuffer.set(sessionId, []);

      logger.app.info(`Claude Code session started: ${sessionId}`);
      return sessionId;

    } catch (error) {
      logger.app.error(`Failed to start Claude session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Send message to Claude Code session
   */
  async sendMessage(sessionId: string, message: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session || !session.process || !session.isActive) {
      throw new Error('Invalid or inactive Claude session');
    }

    // Update last activity
    session.lastActivity = new Date();

    // Send message to Claude process
    session.process.stdin?.write(message + '\n');
    
    logger.app.info(`Message sent to Claude session ${sessionId}`);
  }

  /**
   * Get messages for a session
   */
  getMessages(sessionId: string): ClaudeMessage[] {
    return this.messageBuffer.get(sessionId) || [];
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): ClaudeCodeSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Stop Claude Code session
   */
  async stopSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return; // Already stopped
    }

    try {
      if (session.process && session.isActive) {
        session.process.kill('SIGTERM');
        
        // Give process time to gracefully exit
        setTimeout(() => {
          if (session.process && !session.process.killed) {
            session.process.kill('SIGKILL');
          }
        }, 5000);
      }

      session.isActive = false;
      this.activeSessions.delete(sessionId);
      this.messageBuffer.delete(sessionId);

      logger.app.info(`Claude session stopped: ${sessionId}`);
    } catch (error) {
      logger.app.error(`Error stopping Claude session ${sessionId}:`, error);
    }
  }

  /**
   * List active sessions for user
   */
  getUserSessions(userSessionId: string): ClaudeCodeSession[] {
    const sessions: ClaudeCodeSession[] = [];
    
    for (const session of this.activeSessions.values()) {
      if (session.userSessionId === userSessionId) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }

  // Private methods

  private spawnClaudeProcess(
    sessionId: string, 
    workingDirectory: string, 
    accessToken: string, 
    initialCommand?: string
  ): ChildProcess {
    // Build Claude Code command with OAuth token
    const args = [
      '--output-format', 'stream-json',
      '--verbose',
      '--auth-token', accessToken, // Use OAuth token instead of local auth
    ];

    if (initialCommand) {
      args.push('-p', initialCommand);
    }

    // Spawn Claude Code process
    const process = spawn('claude', args, {
      cwd: workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLAUDE_API_KEY: accessToken, // Fallback environment variable
      }
    });

    // Handle stdout (Claude responses)
    process.stdout?.on('data', (data) => {
      const output = data.toString();
      this.handleClaudeOutput(sessionId, output);
    });

    // Handle stderr (errors and debug info)
    process.stderr?.on('data', (data) => {
      const error = data.toString();
      logger.app.warn(`Claude stderr [${sessionId}]: ${error}`);
      
      // Add error to message buffer
      this.addMessage(sessionId, {
        type: 'system',
        content: { error: error.trim() },
        timestamp: new Date().toISOString(),
        sessionId
      });
    });

    // Handle process exit
    process.on('exit', (code, signal) => {
      logger.app.info(`Claude process exited [${sessionId}]: code=${code}, signal=${signal}`);
      
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.isActive = false;
      }

      // Emit session ended event
      this.emit('sessionEnded', sessionId, code, signal);
    });

    // Handle process errors
    process.on('error', (error) => {
      logger.app.error(`Claude process error [${sessionId}]:`, error);
      
      this.addMessage(sessionId, {
        type: 'system',
        content: { error: `Process error: ${error.message}` },
        timestamp: new Date().toISOString(),
        sessionId
      });
    });

    return process;
  }

  private handleClaudeOutput(sessionId: string, output: string): void {
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        // Try to parse as JSON (stream format)
        const message = JSON.parse(line);
        
        this.addMessage(sessionId, {
          type: message.type || 'assistant',
          content: message,
          timestamp: new Date().toISOString(),
          sessionId
        });

        // Emit real-time message event
        this.emit('message', sessionId, message);
        
      } catch (error) {
        // If not JSON, treat as plain text output
        this.addMessage(sessionId, {
          type: 'assistant',
          content: { text: line },
          timestamp: new Date().toISOString(),
          sessionId
        });
      }
    }
  }

  private addMessage(sessionId: string, message: ClaudeMessage): void {
    const buffer = this.messageBuffer.get(sessionId) || [];
    buffer.push(message);
    
    // Keep only last 1000 messages per session
    if (buffer.length > 1000) {
      buffer.splice(0, buffer.length - 1000);
    }
    
    this.messageBuffer.set(sessionId, buffer);
  }

  private cleanupInactiveSessions(): void {
    const now = new Date();
    const maxInactiveTime = 30 * 60 * 1000; // 30 minutes
    let cleanedCount = 0;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      const inactiveTime = now.getTime() - session.lastActivity.getTime();
      
      if (inactiveTime > maxInactiveTime || !session.isActive) {
        this.stopSession(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.app.info(`Cleaned up ${cleanedCount} inactive Claude sessions`);
    }
  }
}

// Global Claude Code service instance
export const claudeCodeService = new ClaudeCodeService();