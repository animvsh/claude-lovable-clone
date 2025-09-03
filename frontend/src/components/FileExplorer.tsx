import { useState, useEffect, useCallback } from "react";
import {
  FolderIcon,
  FolderOpenIcon,
  DocumentIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

export interface FileExplorerProps {
  projectPath: string;
  className?: string;
  onFileSelect?: (filePath: string) => void;
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  isExpanded?: boolean;
}

export function FileExplorer({ projectPath, className = "", onFileSelect }: FileExplorerProps) {
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch file tree from backend
  const fetchFileTree = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // This would be an API call to get file tree
      // For now, creating a mock file tree
      const mockTree: FileNode = {
        name: projectPath.split('/').pop() || projectPath,
        path: projectPath,
        type: "directory",
        isExpanded: true,
        children: [
          {
            name: "src",
            path: `${projectPath}/src`,
            type: "directory",
            isExpanded: false,
            children: [
              { name: "App.tsx", path: `${projectPath}/src/App.tsx`, type: "file" },
              { name: "index.tsx", path: `${projectPath}/src/index.tsx`, type: "file" },
              { name: "components", path: `${projectPath}/src/components`, type: "directory", children: [] },
              { name: "hooks", path: `${projectPath}/src/hooks`, type: "directory", children: [] },
            ]
          },
          { name: "package.json", path: `${projectPath}/package.json`, type: "file" },
          { name: "README.md", path: `${projectPath}/README.md`, type: "file" },
          { name: "vite.config.ts", path: `${projectPath}/vite.config.ts`, type: "file" },
          {
            name: "node_modules",
            path: `${projectPath}/node_modules`,
            type: "directory",
            children: []
          },
        ]
      };

      setFileTree(mockTree);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree]);

  const toggleDirectory = useCallback((path: string) => {
    setFileTree(prev => {
      if (!prev) return prev;
      
      const updateNode = (node: FileNode): FileNode => {
        if (node.path === path) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children) {
          return {
            ...node,
            children: node.children.map(updateNode)
          };
        }
        return node;
      };

      return updateNode(prev);
    });
  }, []);

  const getFileIcon = (file: FileNode) => {
    if (file.type === "directory") {
      return file.isExpanded ? FolderOpenIcon : FolderIcon;
    }
    return DocumentIcon;
  };


  const renderFileNode = (node: FileNode, depth = 0) => {
    const Icon = getFileIcon(node);
    const isDirectory = node.type === "directory";
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-3 px-3 py-2 hover:bg-white/10 cursor-pointer rounded-lg group transition-all duration-300 hover:scale-105 ${
            isDirectory ? 'font-medium' : 'hover:translate-x-1'
          }`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
          onClick={() => {
            if (isDirectory) {
              toggleDirectory(node.path);
            } else {
              onFileSelect?.(node.path);
            }
          }}
        >
          {isDirectory && (
            <div className="w-4 h-4 flex items-center justify-center">
              {hasChildren ? (
                node.isExpanded ? (
                  <ChevronDownIcon className="h-3 w-3 text-gray-500" />
                ) : (
                  <ChevronRightIcon className="h-3 w-3 text-gray-500" />
                )
              ) : null}
            </div>
          )}
          
          <Icon className={`h-4 w-4 transition-all duration-300 ${
            isDirectory 
              ? 'text-blue-400 group-hover:text-blue-300' 
              : 'text-white/70 group-hover:text-white'
          }`} />
          
          <span className={`text-sm truncate font-medium transition-all duration-300 ${
            isDirectory 
              ? 'text-white group-hover:text-blue-300' 
              : 'text-white/80 group-hover:text-white'
          }`}>
            {node.name}
          </span>
        </div>

        {isDirectory && node.isExpanded && node.children && (
          <div>
            {node.children.map(child => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`h-full bg-transparent ${className}`}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-6">
            <FolderIcon className="h-5 w-5 text-white/70" />
            <span className="text-sm font-semibold text-white">
              Loading Files...
            </span>
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <div className="w-4 h-4 bg-white/20 rounded animate-pulse" />
                <div className={`h-3 bg-white/20 rounded animate-pulse ${
                  i % 2 === 0 ? 'w-24' : 'w-20'
                }`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`h-full bg-white border-r border-gray-200 ${className}`}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <FolderIcon className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-semibold text-gray-900">
              Files
            </span>
          </div>
          <div className="text-center py-8">
            <p className="text-sm text-red-600 mb-2">
              Failed to load files
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {error}
            </p>
            <button
              onClick={fetchFileTree}
              className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full bg-transparent overflow-hidden flex flex-col ${className}`}>
      {/* File tree */}
      <div className="flex-1 overflow-auto p-4">
        {fileTree && (
          <div className="space-y-1">
            {renderFileNode(fileTree)}
          </div>
        )}
      </div>
    </div>
  );
}