/**
 * Minimal runtime abstraction layer
 *
 * Simple interfaces for abstracting runtime-specific operations
 * that are used in the backend application.
 */

import type { MiddlewareHandler } from "hono";

// Command execution result
export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

// File watcher types
export type FileChangeType = "added" | "changed" | "removed";

export interface FileChange {
  path: string;
  type: FileChangeType;
  timestamp: number;
}

export interface FileWatcher {
  watch(path: string, callback: (change: FileChange) => void): Promise<void>;
  unwatch(path: string): Promise<void>;
  close(): Promise<void>;
}

// WebSocket connection interface
export interface WSConnection {
  send(data: string | Buffer): void;
  close(): void;
  on(event: "message" | "close" | "error", callback: (data?: any) => void): void;
}

// Simplified runtime interface - only truly platform-specific operations
export interface Runtime {
  // Process execution (different APIs between Deno and Node.js)
  runCommand(
    command: string,
    args: string[],
    options?: { env?: Record<string, string> },
  ): Promise<CommandResult>;
  findExecutable(name: string): Promise<string[]>;

  // HTTP server (different implementations)
  serve(
    port: number,
    hostname: string,
    handler: (req: Request) => Response | Promise<Response>,
  ): void;

  // Static file serving (different middleware)
  createStaticFileMiddleware(options: { root: string }): MiddlewareHandler;

  // File watching (different implementations)
  createFileWatcher(): FileWatcher;

  // WebSocket support (different implementations)
  upgradeWebSocket(
    request: Request,
    options: {
      onOpen?: (ws: WSConnection) => void;
      onMessage?: (ws: WSConnection, message: string | Buffer) => void;
      onClose?: (ws: WSConnection) => void;
      onError?: (ws: WSConnection, error: Error) => void;
    }
  ): Response;
}
