import { useState, useCallback, useEffect } from "react";
import {
  FolderIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { FileExplorer } from "./FileExplorer";
import { LivePreview } from "./LivePreview";

export interface FilesPreviewToggleProps {
  projectPath: string;
  sessionId: string;
  className?: string;
  onFileSelect?: (filePath: string) => void;
}

type ViewMode = "files" | "preview";

export function FilesPreviewToggle({ 
  projectPath, 
  sessionId, 
  className = "", 
  onFileSelect 
}: FilesPreviewToggleProps) {
  const [activeView, setActiveView] = useState<ViewMode>("files");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Persist view preference in localStorage
  useEffect(() => {
    const savedView = localStorage.getItem(`filesPreviewToggle-${projectPath}`) as ViewMode;
    if (savedView && (savedView === "files" || savedView === "preview")) {
      setActiveView(savedView);
    }
  }, [projectPath]);

  const handleFileSelect = useCallback((filePath: string) => {
    // When a file is selected, switch to files view and forward the selection
    setActiveView("files");
    localStorage.setItem(`filesPreviewToggle-${projectPath}`, "files");
    onFileSelect?.(filePath);
  }, [onFileSelect, projectPath]);

  const handleViewChange = useCallback((view: ViewMode) => {
    setActiveView(view);
    localStorage.setItem(`filesPreviewToggle-${projectPath}`, view);
  }, [projectPath]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Simulate refresh action
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  }, []);

  return (
    <div className={`flex flex-col h-full bg-transparent ${className}`}>
      {/* Modern Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {/* View Toggle */}
        <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-xl p-1">
          <button
            onClick={() => handleViewChange("files")}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
              activeView === "files"
                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <FolderIcon className={`h-4 w-4 transition-transform duration-300 ${
              activeView === "files" ? "scale-110" : "group-hover:scale-105"
            }`} />
            <span className="font-semibold">Files</span>
          </button>
          
          <button
            onClick={() => handleViewChange("preview")}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
              activeView === "preview"
                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <EyeIcon className={`h-4 w-4 transition-transform duration-300 ${
              activeView === "preview" ? "scale-110" : "group-hover:scale-105"
            }`} />
            <span className="font-semibold">Preview</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activeView === "files" && (
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className="pl-9 pr-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                  }
                }}
              />
            </div>
          )}
          
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white/70 hover:text-white hover:bg-white/20 transition-all duration-300 disabled:opacity-50"
            title="Refresh"
          >
            <ArrowPathIcon className={`h-4 w-4 transition-transform duration-300 ${
              isRefreshing ? "animate-spin" : "hover:rotate-180"
            }`} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeView === "files" ? (
          <FileExplorer
            projectPath={projectPath}
            className="h-full"
            onFileSelect={handleFileSelect}
          />
        ) : (
          <LivePreview
            projectPath={projectPath}
            sessionId={sessionId}
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}