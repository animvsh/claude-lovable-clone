/**
 * Supabase MCP Integration Service
 * 
 * Manages connection and interaction with Supabase MCP server
 * for database operations, schema management, and real-time updates.
 */

import type { Runtime } from "../runtime/types.ts";
import { logger } from "../utils/logger.ts";
import path from "node:path";

export interface SupabaseMCPConfig {
  projectRef: string;
  accessToken: string;
  readOnly?: boolean;
  projectPath: string;
}

export interface DatabaseSchema {
  tables: TableInfo[];
  views: ViewInfo[];
  functions: FunctionInfo[];
}

export interface TableInfo {
  name: string;
  schema: string;
  columns: ColumnInfo[];
  constraints: ConstraintInfo[];
  rowCount?: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface ConstraintInfo {
  name: string;
  type: "PRIMARY KEY" | "FOREIGN KEY" | "UNIQUE" | "CHECK";
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
}

export interface ViewInfo {
  name: string;
  schema: string;
  definition: string;
}

export interface FunctionInfo {
  name: string;
  schema: string;
  returnType: string;
  parameters: ParameterInfo[];
}

export interface ParameterInfo {
  name: string;
  type: string;
  mode: "IN" | "OUT" | "INOUT";
}

export interface QueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
}

export class SupabaseMCPService {
  private runtime: Runtime;
  private config: SupabaseMCPConfig;
  private isInitialized = false;

  constructor(runtime: Runtime) {
    this.runtime = runtime;
  }

  /**
   * Initialize MCP connection with Supabase
   */
  async initialize(config: SupabaseMCPConfig): Promise<void> {
    this.config = config;

    try {
      // Create .mcp.json configuration file
      await this.createMCPConfig();
      
      // Verify MCP server is available
      await this.verifyMCPConnection();
      
      this.isInitialized = true;
      
      logger.app.info("Supabase MCP service initialized for project {projectRef}", {
        projectRef: config.projectRef,
      });

    } catch (error) {
      logger.app.error("Failed to initialize Supabase MCP service: {error}", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create MCP configuration file
   */
  private async createMCPConfig(): Promise<void> {
    const mcpConfig = {
      mcpServers: {
        supabase: {
          command: "npx",
          args: [
            "-y",
            "@supabase/mcp-server-supabase@latest",
            ...(this.config.readOnly ? ["--read-only"] : []),
            `--project-ref=${this.config.projectRef}`,
          ],
          env: {
            SUPABASE_ACCESS_TOKEN: this.config.accessToken,
          },
        },
      },
    };

    const configPath = path.join(this.config.projectPath, ".mcp.json");
    const configJson = JSON.stringify(mcpConfig, null, 2);

    // Write MCP configuration
    const writeResult = await this.runtime.runCommand("tee", [configPath], {
      env: { PWD: this.config.projectPath },
    });

    if (!writeResult.success) {
      throw new Error(`Failed to create MCP config: ${writeResult.stderr}`);
    }

    logger.app.debug("Created MCP configuration at {configPath}", { configPath });
  }

  /**
   * Verify MCP server connection
   */
  private async verifyMCPConnection(): Promise<void> {
    // Test MCP server availability
    const testResult = await this.runtime.runCommand("npx", [
      "-y",
      "@supabase/mcp-server-supabase@latest",
      "--version"
    ]);

    if (!testResult.success) {
      throw new Error("Supabase MCP server not available");
    }

    logger.app.debug("MCP server verified: {version}", { version: testResult.stdout.trim() });
  }

  /**
   * Get database schema information
   */
  async getDatabaseSchema(): Promise<DatabaseSchema> {
    this.ensureInitialized();

    try {
      // Use MCP to get schema information
      const tablesResult = await this.executeMCPCommand("list-tables");
      const tables = await this.parseTablesInfo(tablesResult);

      const viewsResult = await this.executeMCPCommand("list-views");  
      const views = await this.parseViewsInfo(viewsResult);

      const functionsResult = await this.executeMCPCommand("list-functions");
      const functions = await this.parseFunctionsInfo(functionsResult);

      return { tables, views, functions };

    } catch (error) {
      logger.app.error("Failed to get database schema: {error}", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Execute SQL query
   */
  async executeQuery(sql: string): Promise<QueryResult> {
    this.ensureInitialized();

    if (this.config.readOnly && this.isWriteOperation(sql)) {
      throw new Error("Write operations not allowed in read-only mode");
    }

    try {
      const startTime = Date.now();
      
      const result = await this.executeMCPCommand("execute-sql", {
        sql,
        includeRowCount: true,
      });

      const executionTime = Date.now() - startTime;

      return this.parseQueryResult(result, executionTime);

    } catch (error) {
      logger.app.error("Failed to execute query: {error}", {
        error: error instanceof Error ? error.message : String(error),
        sql: sql.substring(0, 100) + "...",
      });
      throw error;
    }
  }

  /**
   * Create a new table
   */
  async createTable(
    tableName: string,
    columns: ColumnInfo[],
    constraints: ConstraintInfo[] = []
  ): Promise<boolean> {
    this.ensureInitialized();

    if (this.config.readOnly) {
      throw new Error("Cannot create table in read-only mode");
    }

    try {
      const sql = this.generateCreateTableSQL(tableName, columns, constraints);
      await this.executeQuery(sql);

      logger.app.info("Created table {tableName}", { tableName });
      return true;

    } catch (error) {
      logger.app.error("Failed to create table {tableName}: {error}", {
        tableName,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Generate TypeScript types from schema
   */
  async generateTypes(): Promise<string> {
    this.ensureInitialized();

    try {
      const result = await this.executeMCPCommand("generate-types");
      return result.output || "";

    } catch (error) {
      logger.app.error("Failed to generate types: {error}", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get table data with pagination
   */
  async getTableData(
    tableName: string,
    limit = 100,
    offset = 0,
    orderBy?: string
  ): Promise<QueryResult> {
    this.ensureInitialized();

    let sql = `SELECT * FROM ${tableName}`;
    
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }
    
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    return this.executeQuery(sql);
  }

  /**
   * Execute MCP command
   */
  private async executeMCPCommand(command: string, params?: any): Promise<any> {
    const args = ["npx", "-y", "@supabase/mcp-server-supabase@latest"];
    
    // Add command-specific arguments
    switch (command) {
      case "list-tables":
        args.push("list", "tables");
        break;
      case "list-views":
        args.push("list", "views");
        break;
      case "list-functions":
        args.push("list", "functions");
        break;
      case "execute-sql":
        args.push("sql");
        if (params?.sql) {
          args.push("--query", params.sql);
        }
        break;
      case "generate-types":
        args.push("types", "generate");
        break;
      default:
        throw new Error(`Unknown MCP command: ${command}`);
    }

    const result = await this.runtime.runCommand(args[0], args.slice(1), {
      env: {
        PWD: this.config.projectPath,
        SUPABASE_ACCESS_TOKEN: this.config.accessToken,
        SUPABASE_PROJECT_REF: this.config.projectRef,
      },
    });

    if (!result.success) {
      throw new Error(`MCP command failed: ${result.stderr}`);
    }

    try {
      return JSON.parse(result.stdout);
    } catch {
      return { output: result.stdout };
    }
  }

  /**
   * Parse tables information from MCP response
   */
  private async parseTablesInfo(mcpResult: any): Promise<TableInfo[]> {
    // This would parse the actual MCP response format
    // For now, returning mock data structure
    return mcpResult.tables || [];
  }

  /**
   * Parse views information from MCP response  
   */
  private async parseViewsInfo(mcpResult: any): Promise<ViewInfo[]> {
    return mcpResult.views || [];
  }

  /**
   * Parse functions information from MCP response
   */
  private async parseFunctionsInfo(mcpResult: any): Promise<FunctionInfo[]> {
    return mcpResult.functions || [];
  }

  /**
   * Parse query result from MCP response
   */
  private parseQueryResult(mcpResult: any, executionTime: number): QueryResult {
    return {
      columns: mcpResult.columns || [],
      rows: mcpResult.rows || [],
      rowCount: mcpResult.rowCount || 0,
      executionTime,
    };
  }

  /**
   * Check if SQL is a write operation
   */
  private isWriteOperation(sql: string): boolean {
    const writeKeywords = [
      "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE"
    ];
    
    const upperSQL = sql.trim().toUpperCase();
    return writeKeywords.some(keyword => upperSQL.startsWith(keyword));
  }

  /**
   * Generate CREATE TABLE SQL
   */
  private generateCreateTableSQL(
    tableName: string,
    columns: ColumnInfo[],
    constraints: ConstraintInfo[]
  ): string {
    const columnDefs = columns.map(col => {
      let def = `${col.name} ${col.type}`;
      if (!col.nullable) def += " NOT NULL";
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
      return def;
    });

    const constraintDefs = constraints.map(constraint => {
      switch (constraint.type) {
        case "PRIMARY KEY":
          return `PRIMARY KEY (${constraint.columns.join(", ")})`;
        case "FOREIGN KEY":
          return `FOREIGN KEY (${constraint.columns.join(", ")}) REFERENCES ${constraint.referencedTable} (${constraint.referencedColumns?.join(", ")})`;
        case "UNIQUE":
          return `UNIQUE (${constraint.columns.join(", ")})`;
        default:
          return "";
      }
    }).filter(Boolean);

    const allDefs = [...columnDefs, ...constraintDefs];
    
    return `CREATE TABLE ${tableName} (\n  ${allDefs.join(",\n  ")}\n);`;
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error("Supabase MCP service not initialized");
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      projectRef: this.config?.projectRef,
      readOnly: this.config?.readOnly || false,
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Clean up any persistent connections or resources
    this.isInitialized = false;
    logger.app.info("Supabase MCP service cleaned up");
  }
}