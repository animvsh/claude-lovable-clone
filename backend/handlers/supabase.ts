/**
 * Supabase API Handlers
 * 
 * Provides endpoints for Supabase MCP integration including
 * table listing, query execution, and schema generation.
 */

import { Context } from "hono";
import { SupabaseMCPService } from "../services/SupabaseMCPService.ts";
import { logger } from "../utils/logger.ts";
import type { ConfigContext } from "../middleware/config.ts";

interface SupabaseRequestBody {
  projectPath: string;
  projectRef: string;
  accessToken: string;
  query?: string;
}

// Global service instance cache
const serviceCache = new Map<string, SupabaseMCPService>();

/**
 * Get or create Supabase MCP service instance
 */
async function getSupabaseService(
  runtime: any,
  config: { projectRef: string; accessToken: string; projectPath: string }
): Promise<SupabaseMCPService> {
  const cacheKey = `${config.projectRef}:${config.projectPath}`;
  
  let service = serviceCache.get(cacheKey);
  
  if (!service) {
    service = new SupabaseMCPService(runtime);
    await service.initialize({
      projectRef: config.projectRef,
      accessToken: config.accessToken,
      projectPath: config.projectPath,
      readOnly: false, // Allow write operations for authenticated users
    });
    
    serviceCache.set(cacheKey, service);
  }
  
  return service;
}

/**
 * Handle table listing request
 */
export async function handleSupabaseTablesRequest(c: Context<ConfigContext>) {
  try {
    const body: SupabaseRequestBody = await c.req.json();
    const { runtime } = c.get("config");
    
    logger.app.debug("Supabase tables request: {body}", { 
      body: { ...body, accessToken: "[REDACTED]" }
    });

    // Validate required fields
    if (!body.projectRef || !body.accessToken || !body.projectPath) {
      return c.json({
        error: "Missing required fields: projectRef, accessToken, or projectPath"
      }, 400);
    }

    const service = await getSupabaseService(runtime, {
      projectRef: body.projectRef,
      accessToken: body.accessToken,
      projectPath: body.projectPath,
    });

    const schema = await service.getDatabaseSchema();
    
    return c.json({
      tables: schema.tables,
      views: schema.views,
      functions: schema.functions,
    });

  } catch (error) {
    logger.app.error("Supabase tables request failed: {error}", {
      error: error instanceof Error ? error.message : String(error),
    });

    return c.json({
      error: "Failed to load database schema: " + (error instanceof Error ? error.message : "Unknown error")
    }, 500);
  }
}

/**
 * Handle SQL query execution request
 */
export async function handleSupabaseQueryRequest(c: Context<ConfigContext>) {
  try {
    const body: SupabaseRequestBody = await c.req.json();
    const { runtime } = c.get("config");
    
    logger.app.debug("Supabase query request: {body}", { 
      body: { 
        ...body, 
        accessToken: "[REDACTED]",
        query: body.query?.substring(0, 100) + "..." 
      }
    });

    // Validate required fields
    if (!body.projectRef || !body.accessToken || !body.projectPath || !body.query) {
      return c.json({
        error: "Missing required fields: projectRef, accessToken, projectPath, or query"
      }, 400);
    }

    const service = await getSupabaseService(runtime, {
      projectRef: body.projectRef,
      accessToken: body.accessToken,
      projectPath: body.projectPath,
    });

    const result = await service.executeQuery(body.query);
    
    return c.json({ result });

  } catch (error) {
    logger.app.error("Supabase query request failed: {error}", {
      error: error instanceof Error ? error.message : String(error),
    });

    return c.json({
      error: "Failed to execute query: " + (error instanceof Error ? error.message : "Unknown error")
    }, 500);
  }
}

/**
 * Handle schema generation request
 */
export async function handleSupabaseSchemaRequest(c: Context<ConfigContext>) {
  try {
    const body: SupabaseRequestBody = await c.req.json();
    const { runtime } = c.get("config");
    
    logger.app.debug("Supabase schema request: {body}", { 
      body: { ...body, accessToken: "[REDACTED]" }
    });

    // Validate required fields
    if (!body.projectRef || !body.accessToken || !body.projectPath) {
      return c.json({
        error: "Missing required fields: projectRef, accessToken, or projectPath"
      }, 400);
    }

    const service = await getSupabaseService(runtime, {
      projectRef: body.projectRef,
      accessToken: body.accessToken,
      projectPath: body.projectPath,
    });

    const schema = await service.generateTypes();
    
    return c.json({ schema });

  } catch (error) {
    logger.app.error("Supabase schema request failed: {error}", {
      error: error instanceof Error ? error.message : String(error),
    });

    return c.json({
      error: "Failed to generate schema: " + (error instanceof Error ? error.message : "Unknown error")
    }, 500);
  }
}

/**
 * Handle Supabase service status request
 */
export async function handleSupabaseStatusRequest(c: Context<ConfigContext>) {
  try {
    const body: SupabaseRequestBody = await c.req.json();
    
    const cacheKey = `${body.projectRef}:${body.projectPath}`;
    const service = serviceCache.get(cacheKey);
    
    if (!service) {
      return c.json({
        connected: false,
        error: "No active connection found"
      });
    }

    const status = service.getStatus();
    
    return c.json({
      connected: status.initialized,
      projectRef: status.projectRef,
      readOnly: status.readOnly,
    });

  } catch (error) {
    logger.app.error("Supabase status request failed: {error}", {
      error: error instanceof Error ? error.message : String(error),
    });

    return c.json({
      connected: false,
      error: "Failed to get status: " + (error instanceof Error ? error.message : "Unknown error")
    }, 500);
  }
}

/**
 * Clear service cache (for testing or cleanup)
 */
export function clearSupabaseServiceCache(): void {
  serviceCache.clear();
  logger.app.info("Supabase service cache cleared");
}