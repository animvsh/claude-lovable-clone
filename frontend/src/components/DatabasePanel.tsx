import { useState, useEffect, useCallback } from "react";
import {
  CircleStackIcon,
  TableCellsIcon,
  EyeIcon,
  CommandLineIcon,
  PlayIcon,
  PlusIcon,
  ArrowPathIcon,
  CogIcon,
} from "@heroicons/react/24/outline";
import { useSupabase } from "../contexts/SupabaseContext";
import { SupabaseConfig } from "./SupabaseConfig";
import { SupabaseAuth } from "./SupabaseAuth";

export interface DatabasePanelProps {
  projectPath: string;
  className?: string;
}

interface TableInfo {
  name: string;
  schema: string;
  rowCount?: number;
  columns: ColumnInfo[];
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

interface QueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
}

type TabType = "setup" | "tables" | "query" | "schema";

export function DatabasePanel({ projectPath, className = "" }: DatabasePanelProps) {
  const { isConfigured, user, getMCPConfig } = useSupabase();
  const [activeTab, setActiveTab] = useState<TabType>("setup");
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Query tab state
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM users LIMIT 10;");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Schema tab state
  const [schema, setSchema] = useState<string>("");
  const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);

  // Auto-switch to tables tab when fully authenticated
  useEffect(() => {
    if (isConfigured && user && activeTab === "setup") {
      setActiveTab("tables");
    }
  }, [isConfigured, user, activeTab]);

  const loadTables = useCallback(async () => {
    if (!isConfigured || !user) return;

    const mcpConfig = getMCPConfig();
    if (!mcpConfig) {
      setError("Unable to get MCP configuration. Please re-authenticate.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call backend API to initialize Supabase MCP service
      const response = await fetch("/api/supabase/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPath,
          projectRef: mcpConfig.projectRef,
          accessToken: mcpConfig.accessToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setTables(data.tables || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tables");
      console.error("Failed to load tables:", err);
    } finally {
      setLoading(false);
    }
  }, [isConfigured, user, getMCPConfig, projectPath]);

  const executeQuery = async () => {
    if (!isConfigured || !user || !sqlQuery.trim()) return;

    const mcpConfig = getMCPConfig();
    if (!mcpConfig) {
      setError("Unable to get MCP configuration. Please re-authenticate.");
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const response = await fetch("/api/supabase/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPath,
          projectRef: mcpConfig.projectRef,
          accessToken: mcpConfig.accessToken,
          query: sqlQuery,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setQueryResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute query");
      console.error("Failed to execute query:", err);
    } finally {
      setIsExecuting(false);
    }
  };

  const generateSchema = async () => {
    if (!isConfigured || !user) return;

    const mcpConfig = getMCPConfig();
    if (!mcpConfig) {
      setError("Unable to get MCP configuration. Please re-authenticate.");
      return;
    }

    setIsGeneratingSchema(true);
    setError(null);

    try {
      const response = await fetch("/api/supabase/schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPath,
          projectRef: mcpConfig.projectRef,
          accessToken: mcpConfig.accessToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setSchema(data.schema || "// No schema available");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate schema");
      console.error("Failed to generate schema:", err);
    } finally {
      setIsGeneratingSchema(false);
    }
  };

  const tabs = [
    { id: "setup" as TabType, name: "Setup", icon: CogIcon },
    { id: "tables" as TabType, name: "Tables", icon: TableCellsIcon },
    { id: "query" as TabType, name: "SQL Query", icon: CommandLineIcon },
    { id: "schema" as TabType, name: "Types", icon: EyeIcon },
  ];

  const renderSetupTab = () => (
    <div className="space-y-6">
      <SupabaseConfig
        onConfigured={() => {
          // Configuration completed, user can now authenticate
        }}
      />
      
      {isConfigured && (
        <SupabaseAuth
          onAuthenticated={() => {
            setActiveTab("tables");
            loadTables();
          }}
        />
      )}
    </div>
  );

  const renderTablesTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-900">Database Tables</h3>
        <button
          onClick={loadTables}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      )}

      {!loading && tables.length === 0 && !error && (
        <div className="text-center py-8 text-gray-500">
          <TableCellsIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No tables found</p>
          <button
            onClick={loadTables}
            className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
          >
            Load Tables
          </button>
        </div>
      )}

      <div className="space-y-2">
        {tables.map((table) => (
          <div key={`${table.schema}.${table.name}`} className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TableCellsIcon className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm">
                  {table.schema !== "public" && `${table.schema}.`}
                  {table.name}
                </span>
              </div>
              {table.rowCount !== undefined && (
                <span className="text-xs text-gray-500">{table.rowCount} rows</span>
              )}
            </div>
            
            <div className="grid grid-cols-1 gap-1">
              {table.columns.slice(0, 5).map((column) => (
                <div key={column.name} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">
                    {column.name}
                    {column.isPrimaryKey && <span className="text-yellow-600 ml-1">🔑</span>}
                  </span>
                  <span className="text-gray-400 font-mono">{column.type}</span>
                </div>
              ))}
              {table.columns.length > 5 && (
                <div className="text-xs text-gray-400">
                  ... and {table.columns.length - 5} more columns
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderQueryTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-900">SQL Query Editor</h3>
        <button
          onClick={executeQuery}
          disabled={isExecuting || !sqlQuery.trim()}
          className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
        >
          <PlayIcon className="h-3 w-3" />
          Execute
        </button>
      </div>

      <textarea
        value={sqlQuery}
        onChange={(e) => setSqlQuery(e.target.value)}
        placeholder="Enter your SQL query here..."
        rows={6}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-blue-500 focus:border-blue-500"
      />

      {isExecuting && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          Executing query...
        </div>
      )}

      {queryResult && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">
              {queryResult.rowCount} row{queryResult.rowCount !== 1 ? 's' : ''} returned
            </span>
            <span className="text-gray-500">
              {queryResult.executionTime}ms
            </span>
          </div>
          
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {queryResult.columns.map((column) => (
                      <th key={column} className="px-3 py-2 text-left font-medium text-gray-900 border-r border-gray-200 last:border-r-0">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {queryResult.rows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 text-gray-600 border-r border-gray-100 last:border-r-0">
                          {cell === null ? <span className="text-gray-400 italic">null</span> : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {queryResult.rows.length > 50 && (
            <p className="text-xs text-gray-500">
              Showing first 50 rows of {queryResult.rowCount}
            </p>
          )}
        </div>
      )}
    </div>
  );

  const renderSchemaTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-900">TypeScript Types</h3>
        <button
          onClick={generateSchema}
          disabled={isGeneratingSchema}
          className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50"
        >
          <PlusIcon className="h-3 w-3" />
          Generate
        </button>
      </div>

      {isGeneratingSchema && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
          Generating TypeScript types...
        </div>
      )}

      {schema && (
        <div className="border rounded-lg overflow-hidden">
          <pre className="p-4 text-sm font-mono bg-gray-50 overflow-x-auto">
            {schema}
          </pre>
        </div>
      )}

      {!schema && !isGeneratingSchema && (
        <div className="text-center py-8 text-gray-500">
          <EyeIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Click "Generate" to create TypeScript types from your database schema</p>
        </div>
      )}
    </div>
  );

  return (
    <div className={`flex flex-col h-full bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <CircleStackIcon className="h-5 w-5 text-blue-600" />
        <h2 className="font-medium text-gray-900">Database</h2>
        {isConfigured && user && (
          <span className="ml-auto text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
            Connected
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => {
          const isDisabled = (tab.id === "tables" || tab.id === "query" || tab.id === "schema") && (!isConfigured || !user);
          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && setActiveTab(tab.id)}
              disabled={isDisabled}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600 bg-blue-50"
                  : isDisabled
                  ? "border-transparent text-gray-400 cursor-not-allowed"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <tab.icon className="h-3 w-3" />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {activeTab === "setup" && renderSetupTab()}
        {activeTab === "tables" && renderTablesTab()}
        {activeTab === "query" && renderQueryTab()}
        {activeTab === "schema" && renderSchemaTab()}
      </div>
    </div>
  );
}