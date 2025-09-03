import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from "react";
import {
  DocumentTextIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  EyeIcon,
  CodeBracketIcon,
  FolderOpenIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

export interface CodeViewerProps {
  projectPath: string;
  className?: string;
  onFileSelect?: (filePath: string) => void;
  selectedFilePath?: string | null;
}

export interface CodeViewerRef {
  openFile: (filePath: string) => void;
}

interface FileContent {
  path: string;
  content: string;
  language: string;
  isModified: boolean;
}

interface Tab {
  id: string;
  path: string;
  name: string;
  isModified: boolean;
  language: string;
}

export const CodeViewer = forwardRef<CodeViewerRef, CodeViewerProps>(
  ({ projectPath: _projectPath, className = "", onFileSelect, selectedFilePath }, ref) => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Map<string, FileContent>>(new Map());
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const activeFileContent = activeTab ? fileContents.get(activeTab.path) : null;

  // Get file language based on extension
  const getFileLanguage = useCallback((filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'html': 'html',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'xml': 'xml',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'sh': 'bash',
      'sql': 'sql',
      'dockerfile': 'docker',
    };
    return languageMap[ext || ''] || 'text';
  }, []);

  // Load file content
  const loadFileContent = useCallback(async (filePath: string): Promise<FileContent | null> => {
    if (fileContents.has(filePath)) {
      return fileContents.get(filePath)!;
    }

    try {
      setLoading(true);
      setError(null);

      // This would be an API call to read file content
      // For now, we'll simulate loading
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const mockContent = `// File: ${filePath}
// This is a mock file viewer
// In a real implementation, this would load actual file content

export function ExampleComponent() {
  console.log("Loading file: ${filePath}");
  return <div>Content from ${filePath}</div>;
}`;

      const content: FileContent = {
        path: filePath,
        content: mockContent,
        language: getFileLanguage(filePath),
        isModified: false,
      };

      setFileContents(prev => new Map(prev).set(filePath, content));
      return content;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load file");
      return null;
    } finally {
      setLoading(false);
    }
  }, [fileContents, getFileLanguage]);

  // Open file in new tab
  const openFile = useCallback(async (filePath: string) => {
    // Check if tab already exists
    const existingTab = tabs.find(tab => tab.path === filePath);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    // Load file content
    const content = await loadFileContent(filePath);
    if (!content) return;

    // Create new tab
    const newTab: Tab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      path: filePath,
      name: filePath.split('/').pop() || filePath,
      isModified: false,
      language: content.language,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    onFileSelect?.(filePath);
  }, [tabs, loadFileContent, onFileSelect]);

  // Close tab
  const closeTab = useCallback((tabId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    
    setTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      
      // If we're closing the active tab, switch to another one
      if (tabId === activeTabId) {
        const closingTabIndex = prev.findIndex(tab => tab.id === tabId);
        if (newTabs.length > 0) {
          // Try to activate the tab to the right, then left
          const newActiveTab = newTabs[closingTabIndex] || newTabs[closingTabIndex - 1] || newTabs[0];
          setActiveTabId(newActiveTab.id);
        } else {
          setActiveTabId(null);
        }
      }
      
      return newTabs;
    });
  }, [activeTabId]);

  // Start editing
  const startEditing = useCallback(() => {
    if (activeFileContent) {
      setEditContent(activeFileContent.content);
      setIsEditing(true);
      // Focus textarea after render
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [activeFileContent]);

  // Save changes
  const saveChanges = useCallback(async () => {
    if (!activeTab || !activeFileContent) return;

    try {
      setLoading(true);
      setError(null);

      // This would be an API call to save the file
      // For now, we'll simulate saving
      await new Promise(resolve => setTimeout(resolve, 300));

      // Update file content
      const updatedContent: FileContent = {
        ...activeFileContent,
        content: editContent,
        isModified: false,
      };

      setFileContents(prev => new Map(prev).set(activeTab.path, updatedContent));
      
      // Update tab
      setTabs(prev => prev.map(tab => 
        tab.id === activeTab.id 
          ? { ...tab, isModified: false }
          : tab
      ));

      setIsEditing(false);
      setEditContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save file");
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeFileContent, editContent]);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditContent("");
  }, []);

  // Handle content change during editing
  const handleContentChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(event.target.value);
    
    // Mark as modified if content differs from original
    if (activeTab && activeFileContent) {
      const isModified = event.target.value !== activeFileContent.content;
      setTabs(prev => prev.map(tab => 
        tab.id === activeTab.id 
          ? { ...tab, isModified }
          : tab
      ));
    }
  }, [activeTab, activeFileContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(200, textarea.scrollHeight) + 'px';
    }
  }, [editContent]);

  // Handle external file selection
  useEffect(() => {
    if (selectedFilePath) {
      openFile(selectedFilePath);
    }
  }, [selectedFilePath, openFile]);

  // Expose openFile method to parent component
  useImperativeHandle(ref, () => ({
    openFile,
  }), [openFile]);

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-slate-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <CodeBracketIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Code Editor
          </span>
        </div>
        
        {activeTab && (
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={startEditing}
                className="p-1.5 rounded-md bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600"
                title="Edit file"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={saveChanges}
                  disabled={loading}
                  className="p-1.5 rounded-md bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
                  title="Save changes"
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={loading}
                  className="p-1.5 rounded-md bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50"
                  title="Cancel editing"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            )}
            
            <button
              onClick={() => loadFileContent(activeTab.path)}
              disabled={loading}
              className="p-1.5 rounded-md bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50"
              title="Refresh file"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      {tabs.length > 0 && (
        <div className="flex items-center bg-gray-100 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-2 px-3 py-2 border-r border-gray-200 dark:border-slate-600 cursor-pointer min-w-0 ${
                tab.id === activeTabId
                  ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'
              }`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <DocumentTextIcon className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm truncate">{tab.name}</span>
              {tab.isModified && (
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
              )}
              <button
                onClick={(e) => closeTab(tab.id, e)}
                className="p-0.5 rounded-sm hover:bg-gray-200 dark:hover:bg-slate-500 flex-shrink-0"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2">
              <XMarkIcon className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </div>
          </div>
        )}

        {!activeTab ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <FolderOpenIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No File Selected
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Select a file from the file explorer to view and edit it
              </p>
              <div className="mt-4">
                <button
                  onClick={() => openFile('example.tsx')}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                >
                  Open Example File
                </button>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4" />
              <div className="text-sm text-gray-600 dark:text-gray-400">Loading file...</div>
            </div>
          </div>
        ) : isEditing ? (
          <div className="flex-1 flex flex-col p-4">
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={handleContentChange}
              className="flex-1 w-full p-3 border border-gray-200 dark:border-slate-600 rounded-lg font-mono text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Edit your code here..."
            />
            
            <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-gray-400">
              <span>Language: {activeTab.language}</span>
              <span>{editContent.split('\n').length} lines</span>
            </div>
          </div>
        ) : activeFileContent ? (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 p-4 overflow-auto">
              <pre className="font-mono text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
                {activeFileContent.content}
              </pre>
            </div>
            
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-xs text-gray-500 dark:text-gray-400">
              <span>Language: {activeFileContent.language}</span>
              <div className="flex items-center gap-4">
                <span>{activeFileContent.content.split('\n').length} lines</span>
                <span className="flex items-center gap-1">
                  <EyeIcon className="h-3 w-3" />
                  Read-only
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});