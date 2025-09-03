/**
 * Node.js runtime implementation
 *
 * Simplified implementation focusing only on platform-specific operations.
 */

import { spawn, type SpawnOptions } from "node:child_process";
import { watch, type FSWatcher } from "node:fs";
import { WebSocketServer, WebSocket } from "ws";
import process from "node:process";
import { serve } from "@hono/node-server";
import { createServer } from "node:http";
import { Hono } from "hono";
import type { 
  CommandResult, 
  Runtime, 
  FileWatcher, 
  FileChange, 
  FileChangeType,
  WSConnection 
} from "./types.ts";
import type { MiddlewareHandler } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { getPlatform } from "../utils/os.ts";

// Node.js File Watcher implementation
class NodeFileWatcher implements FileWatcher {
  private watchers: Map<string, FSWatcher> = new Map();

  async watch(path: string, callback: (change: FileChange) => void): Promise<void> {
    if (this.watchers.has(path)) {
      await this.unwatch(path);
    }

    const watcher = watch(path, { recursive: true }, (eventType, filename) => {
      if (!filename) return;

      let changeType: FileChangeType;
      switch (eventType) {
        case "rename":
          changeType = "added"; // Could be added or removed, but we'll assume added
          break;
        case "change":
          changeType = "changed";
          break;
        default:
          changeType = "changed";
      }

      callback({
        path: typeof filename === "string" ? filename : String(filename),
        type: changeType,
        timestamp: Date.now(),
      });
    });

    this.watchers.set(path, watcher);
  }

  async unwatch(path: string): Promise<void> {
    const watcher = this.watchers.get(path);
    if (watcher) {
      watcher.close();
      this.watchers.delete(path);
    }
  }

  async close(): Promise<void> {
    for (const [path, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }
}

// Node.js WebSocket Connection wrapper
class NodeWSConnection implements WSConnection {
  constructor(public ws: WebSocket) {}

  send(data: string | Buffer): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  close(): void {
    this.ws.close();
  }

  on(event: "message" | "close" | "error", callback: (data?: any) => void): void {
    this.ws.on(event, callback);
  }
}

export class NodeRuntime implements Runtime {
  async findExecutable(name: string): Promise<string[]> {
    const platform = getPlatform();
    const candidates: string[] = [];

    if (platform === "windows") {
      // Try multiple possible executable names on Windows
      const executableNames = [
        name,
        `${name}.exe`,
        `${name}.cmd`,
        `${name}.bat`,
      ];

      for (const execName of executableNames) {
        const result = await this.runCommand("where", [execName]);
        if (result.success && result.stdout.trim()) {
          // where command can return multiple paths, split by newlines
          const paths = result.stdout
            .trim()
            .split("\n")
            .map((p) => p.trim())
            .filter((p) => p);
          candidates.push(...paths);
        }
      }
    } else {
      // Unix-like systems (macOS, Linux)
      const result = await this.runCommand("which", [name]);
      if (result.success && result.stdout.trim()) {
        candidates.push(result.stdout.trim());
      }
    }

    return candidates;
  }

  runCommand(
    command: string,
    args: string[],
    options?: { env?: Record<string, string> },
  ): Promise<CommandResult> {
    return new Promise((resolve) => {
      const isWindows = getPlatform() === "windows";
      const spawnOptions: SpawnOptions = {
        stdio: ["ignore", "pipe", "pipe"],
        env: options?.env ? { ...process.env, ...options.env } : process.env,
      };

      // On Windows, always use cmd.exe /c for all commands
      let actualCommand = command;
      let actualArgs = args;

      if (isWindows) {
        actualCommand = "cmd.exe";
        actualArgs = ["/c", command, ...args];
      }

      const child = spawn(actualCommand, actualArgs, spawnOptions);

      const textDecoder = new TextDecoder();
      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data: Uint8Array) => {
        stdout += textDecoder.decode(data, { stream: true });
      });

      child.stderr?.on("data", (data: Uint8Array) => {
        stderr += textDecoder.decode(data, { stream: true });
      });

      child.on("close", (code: number | null) => {
        resolve({
          success: code === 0,
          code: code ?? 1,
          stdout,
          stderr,
        });
      });

      child.on("error", (error: Error) => {
        resolve({
          success: false,
          code: 1,
          stdout: "",
          stderr: error.message,
        });
      });
    });
  }

  serve(
    port: number,
    hostname: string,
    handler: (req: Request) => Response | Promise<Response>,
  ): void {
    // Create HTTP server with WebSocket support
    const server = createServer();
    
    // Create WebSocket server that shares the HTTP server
    const wss = new WebSocketServer({ server, path: '/ws' });
    
    // Handle WebSocket connections
    wss.on('connection', (ws, request) => {
      console.log('WebSocket connection established');
      
      // Create our WebSocket wrapper
      const wsConnection = new NodeWSConnection(ws);
      
      // Handle connection through our WebSocket service
      this.handleWebSocketConnection(wsConnection, request);
    });
    
    // Handle HTTP requests through Hono
    server.on('request', async (req, res) => {
      try {
        // Convert Node.js request to Web API Request
        const url = `http://${req.headers.host}${req.url}`;
        let body = undefined;
        
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          body = Buffer.concat(chunks);
        }
        
        const webRequest = new Request(url, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body,
        });
        
        // Get response from Hono handler
        const response = await handler(webRequest);
        
        // Convert Web API Response back to Node.js response
        res.statusCode = response.status;
        
        // Set headers
        for (const [key, value] of response.headers) {
          res.setHeader(key, value);
        }
        
        // Send body
        if (response.body) {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        }
        res.end();
        
      } catch (error) {
        console.error('Request handling error:', error);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
    
    // Start the server
    server.listen(port, hostname, () => {
      console.log(`Listening on http://${hostname}:${port}/`);
    });
  }
  
  private handleWebSocketConnection(wsConnection: NodeWSConnection, request: any): void {
    // This will be called by the WebSocket service
    // For now, just send a welcome message
    wsConnection.send(JSON.stringify({
      type: 'connection_established',
      message: 'WebSocket connected successfully'
    }));
    
    // Get the underlying WebSocket to handle events
    const ws = wsConnection.ws;
    
    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('WebSocket message received:', message);
        
        // Echo back for now
        wsConnection.send(JSON.stringify({
          type: 'echo',
          originalMessage: message
        }));
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  createStaticFileMiddleware(options: { root: string }): MiddlewareHandler {
    return serveStatic(options);
  }

  createFileWatcher(): FileWatcher {
    return new NodeFileWatcher();
  }

  upgradeWebSocket(
    request: Request,
    options: {
      onOpen?: (ws: WSConnection) => void;
      onMessage?: (ws: WSConnection, message: string | Buffer) => void;
      onClose?: (ws: WSConnection) => void;
      onError?: (ws: WSConnection, error: Error) => void;
    }
  ): Response {
    // Create a response that indicates WebSocket upgrade is handled elsewhere
    // The actual upgrade will be handled by the Hono WebSocket middleware
    return new Response(null, {
      status: 101,
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
      }
    });
  }
}
