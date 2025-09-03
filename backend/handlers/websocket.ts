/**
 * WebSocket handlers for real-time communication
 * 
 * Handles WebSocket connections for live preview, file watching,
 * and real-time collaboration features.
 */

import { createNodeWebSocket } from "@hono/node-ws";
import type { Context } from "hono";
import { WebSocket } from "ws";
import { FileWatcherService } from "../services/FileWatcherService.ts";
import { logger } from "../utils/logger.ts";

// Global file watcher service instance
let fileWatcherService: FileWatcherService;

export function initializeWebSocketService(runtime: any) {
  fileWatcherService = new FileWatcherService(runtime);
}

export interface WebSocketMessage {
  type: string;
  sessionId?: string;
  projectPath?: string;
  data?: any;
}

export function handleWebSocketUpgrade(c: Context) {
  const upgrade = c.env?.upgrade;
  if (!upgrade) {
    return c.text('WebSocket upgrade not available', 400);
  }

  return upgrade(c, (ws) => {
    logger.app.info("WebSocket connection opened");
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connection_established',
      timestamp: Date.now(),
    }));

    ws.on('message', async (message: Buffer | string) => {
      try {
        const data: WebSocketMessage = JSON.parse(message.toString());
        await handleWebSocketMessage(ws, data);
      } catch (error) {
        logger.app.error("Error parsing WebSocket message: {error}", {
          error: error instanceof Error ? error.message : String(error),
        });
        
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format',
          timestamp: Date.now(),
        }));
      }
    });

    ws.on('close', () => {
      logger.app.info("WebSocket connection closed");
    });

    ws.on('error', (error: Error) => {
      logger.app.error("WebSocket error: {error}", { error: error.message });
    });
  });
}

async function handleWebSocketMessage(ws: WebSocket, message: WebSocketMessage) {
  const { type, sessionId, projectPath, data } = message;

  logger.app.debug("Received WebSocket message: {type}", { type });

  try {
    switch (type) {
      case 'start_watching':
        if (!sessionId || !projectPath) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Missing sessionId or projectPath',
            timestamp: Date.now(),
          }));
          return;
        }

        // Create a simple WebSocket adapter
        const wsAdapter = {
          send: (data: string | Buffer) => ws.send(data),
          close: () => ws.close(),
          on: (event: "message" | "close" | "error", callback: (data?: any) => void) => {
            ws.on(event as any, callback);
          }
        };
        await fileWatcherService.startWatching(sessionId, projectPath, wsAdapter as any);
        break;

      case 'stop_watching':
        if (!sessionId) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Missing sessionId',
            timestamp: Date.now(),
          }));
          return;
        }

        await fileWatcherService.stopWatching(sessionId);
        ws.send(JSON.stringify({
          type: 'watch_stopped',
          sessionId,
          timestamp: Date.now(),
        }));
        break;

      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now(),
        }));
        break;

      case 'get_active_sessions':
        const activeSessions = fileWatcherService.getActiveSessions();
        ws.send(JSON.stringify({
          type: 'active_sessions',
          sessions: activeSessions,
          timestamp: Date.now(),
        }));
        break;

      case 'live_preview_request':
        await handleLivePreviewRequest(ws, data);
        break;

      case 'build_request':
        await handleBuildRequest(ws, sessionId, projectPath);
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          error: `Unknown message type: ${type}`,
          timestamp: Date.now(),
        }));
    }
  } catch (error) {
    logger.app.error("Error handling WebSocket message {type}: {error}", {
      type,
      error: error instanceof Error ? error.message : String(error),
    });

    ws.send(JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
    }));
  }
}

async function handleLivePreviewRequest(ws: WebSocket, data: any) {
  const { sessionId, url, viewport } = data;

  // For now, just acknowledge the preview request
  // In a full implementation, this would integrate with a headless browser
  ws.send(JSON.stringify({
    type: 'live_preview_response',
    sessionId,
    status: 'ready',
    previewUrl: url,
    viewport: viewport || { width: 1200, height: 800 },
    timestamp: Date.now(),
  }));
}

async function handleBuildRequest(ws: WebSocket, sessionId?: string, projectPath?: string) {
  if (!sessionId || !projectPath) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Missing sessionId or projectPath for build request',
      timestamp: Date.now(),
    }));
    return;
  }

  ws.send(JSON.stringify({
    type: 'build_started',
    sessionId,
    timestamp: Date.now(),
  }));

  // Build will be handled by the FileWatcherService
  // This is just a manual trigger
}

export async function cleanupWebSocketService() {
  if (fileWatcherService) {
    await fileWatcherService.cleanup();
  }
}