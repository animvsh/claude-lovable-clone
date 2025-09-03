/**
 * Runtime-agnostic Hono application
 *
 * This module creates the Hono application with all routes and middleware,
 * but doesn't include runtime-specific code like CLI parsing or server startup.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
// WebSocket handling moved to NodeRuntime
import type { Runtime } from "./runtime/types.ts";
import {
  type ConfigContext,
  createConfigMiddleware,
} from "./middleware/config.ts";
import { handleProjectsRequest } from "./handlers/projects.ts";
import { handleHistoriesRequest } from "./handlers/histories.ts";
import { handleConversationRequest } from "./handlers/conversations.ts";
import { handleChatRequest } from "./handlers/chat.ts";
import { handleAbortRequest } from "./handlers/abort.ts";
import { syncProjectWithGitHub, autoCommitAndPush, getGitStatus } from "./handlers/github.ts";
import { handleWebSocketUpgrade, initializeWebSocketService } from "./handlers/websocket.ts";
import { 
  cloneAndInitialize, 
  getWorkspaces, 
  initializeClaudeEnvironment, 
  deleteWorkspace, 
  getWorkspaceStatus 
} from "./handlers/workspaces.ts";
import {
  initializeSync,
  getSyncStatus,
  commitAndSync,
  syncWithRemote,
  createBranch,
  switchBranch,
  stopSync,
  getBranches
} from "./handlers/sync.ts";
import {
  initiateGitHubAuth,
  handleGitHubCallback,
  initiateClaudeAuth,
  handleClaudeCallback,
  getAuthStatus,
  logoutGitHub,
  logoutClaude,
  getGitHubRepositories,
  executeClaudeCommand,
  createAuthMiddleware
} from "./handlers/oauth.ts";
import { 
  handleSupabaseTablesRequest,
  handleSupabaseQueryRequest,
  handleSupabaseSchemaRequest,
  handleSupabaseStatusRequest 
} from "./handlers/supabase.ts";
import { logger } from "./utils/logger.ts";
import { readBinaryFile } from "./utils/fs.ts";

export interface AppConfig {
  debugMode: boolean;
  staticPath: string;
  cliPath: string; // Actual CLI script path detected by validateClaudeCli
}

export function createApp(
  runtime: Runtime,
  config: AppConfig,
): Hono<ConfigContext> {
  const app = new Hono<ConfigContext>();

  // Initialize WebSocket services - handled in NodeRuntime
  initializeWebSocketService(runtime);

  // Store AbortControllers for each request (shared with chat handler)
  const requestAbortControllers = new Map<string, AbortController>();

  // CORS middleware
  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

  // Configuration middleware - makes app settings available to all handlers
  app.use(
    "*",
    createConfigMiddleware({
      debugMode: config.debugMode,
      runtime,
      cliPath: config.cliPath,
    }),
  );

  // Authentication middleware - extracts OAuth sessions from cookies
  app.use("*", createAuthMiddleware());

  // API routes
  app.get("/api/projects", (c) => handleProjectsRequest(c));

  app.get("/api/projects/:encodedProjectName/histories", (c) =>
    handleHistoriesRequest(c),
  );

  app.get("/api/projects/:encodedProjectName/histories/:sessionId", (c) =>
    handleConversationRequest(c),
  );

  app.post("/api/abort/:requestId", (c) =>
    handleAbortRequest(c, requestAbortControllers),
  );

  app.post("/api/chat", (c) => handleChatRequest(c, requestAbortControllers));

  // GitHub integration endpoints
  app.post("/api/github/sync", (c) => syncProjectWithGitHub(c));
  app.post("/api/github/auto-commit", (c) => autoCommitAndPush(c));
  app.get("/api/github/status", (c) => getGitStatus(c));

  // Supabase MCP integration endpoints
  app.post("/api/supabase/tables", (c) => handleSupabaseTablesRequest(c));
  app.post("/api/supabase/query", (c) => handleSupabaseQueryRequest(c));
  app.post("/api/supabase/schema", (c) => handleSupabaseSchemaRequest(c));
  app.post("/api/supabase/status", (c) => handleSupabaseStatusRequest(c));

  // Workspace management endpoints
  app.post("/api/workspaces/clone-and-initialize", (c) => cloneAndInitialize(c));
  app.get("/api/workspaces", (c) => getWorkspaces(c));
  app.post("/api/workspaces/:workspaceId/initialize-claude", (c) => initializeClaudeEnvironment(c));
  app.get("/api/workspaces/:workspaceId/status", (c) => getWorkspaceStatus(c));
  app.delete("/api/workspaces/:workspaceId", (c) => deleteWorkspace(c));

  // GitHub sync endpoints
  app.post("/api/sync/initialize", (c) => initializeSync(c));
  app.get("/api/sync/:workspaceId/status", (c) => getSyncStatus(c));
  app.post("/api/sync/commit", (c) => commitAndSync(c));
  app.post("/api/sync/:workspaceId/pull", (c) => syncWithRemote(c));
  app.post("/api/sync/branch/create", (c) => createBranch(c));
  app.post("/api/sync/branch/switch", (c) => switchBranch(c));
  app.get("/api/sync/:workspaceId/branches", (c) => getBranches(c));
  app.delete("/api/sync/:workspaceId", (c) => stopSync(c));

  // OAuth authentication endpoints
  app.get("/auth/github", (c) => initiateGitHubAuth(c));
  app.get("/auth/github/callback", (c) => handleGitHubCallback(c));
  app.get("/auth/claude", (c) => initiateClaudeAuth(c));
  app.get("/auth/claude/callback", (c) => handleClaudeCallback(c));
  app.get("/api/auth/status", (c) => getAuthStatus(c));
  app.post("/api/auth/github/logout", (c) => logoutGitHub(c));
  app.post("/api/auth/claude/logout", (c) => logoutClaude(c));
  
  // OAuth-enabled endpoints
  app.get("/api/github/repositories", (c) => getGitHubRepositories(c));
  app.post("/api/claude/execute", (c) => executeClaudeCommand(c));

  // WebSocket endpoint handled in NodeRuntime at /ws path

  // Static file serving with SPA fallback
  // Serve static assets (CSS, JS, images, etc.)
  const serveStatic = runtime.createStaticFileMiddleware({
    root: config.staticPath,
  });
  app.use("/assets/*", serveStatic);

  // SPA fallback - serve index.html for all unmatched routes (except API routes)
  app.get("*", async (c) => {
    const path = c.req.path;

    // Skip API routes
    if (path.startsWith("/api/")) {
      return c.text("Not found", 404);
    }

    try {
      const indexPath = `${config.staticPath}/index.html`;
      const indexFile = await readBinaryFile(indexPath);
      return c.html(new TextDecoder().decode(indexFile));
    } catch (error) {
      logger.app.error("Error serving index.html: {error}", { error });
      return c.text("Internal server error", 500);
    }
  });

  return app;
}
