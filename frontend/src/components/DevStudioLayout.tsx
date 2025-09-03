import { useState, useCallback, useEffect } from "react";
import { 
  ChatBubbleLeftRightIcon,
  EyeIcon,
  CogIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { ChatPage } from "./ChatPage";
import { FilesPreviewToggle } from "./FilesPreviewToggle";
import { SyncIndicator } from "./SyncIndicator";
import { SyncSettingsPanel } from "./SyncSettingsPanel";

export interface DevStudioLayoutProps {
  workingDirectory: string;
  sessionId: string;
}

// Extract workspace ID from working directory path
function extractWorkspaceId(workingDirectory: string): string {
  const parts = workingDirectory.split('/');
  return parts[parts.length - 1] || '';
}

type PanelType = "chat" | "files-preview";

interface PanelConfig {
  type: PanelType;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
  width?: number; // Percentage of container width
}

const DEFAULT_PANELS: PanelConfig[] = [
  { type: "chat", title: "Chat", icon: ChatBubbleLeftRightIcon, visible: true, width: 50 },
  { type: "files-preview", title: "Files & Preview", icon: EyeIcon, visible: true, width: 50 },
];

export function DevStudioLayout({ workingDirectory, sessionId }: DevStudioLayoutProps) {
  const [panels, setPanels] = useState<PanelConfig[]>(DEFAULT_PANELS);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const workspaceId = extractWorkspaceId(workingDirectory);

  const togglePanel = useCallback((panelType: PanelType) => {
    setPanels(prev => prev.map(panel => 
      panel.type === panelType 
        ? { ...panel, visible: !panel.visible }
        : panel
    ));
  }, []);

  // Get visible panels
  const visiblePanels = panels.filter(panel => panel.visible);

  // Handle file selection - just for future use
  const handleFileSelect = useCallback((filePath: string) => {
    console.log("File selected:", filePath);
    // Could be used for future integrations
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        togglePanel('chat');
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        togglePanel('files-preview');
      } else if (e.key === '?') {
        e.preventDefault();
        // Show help modal (placeholder for future implementation)
        console.log('Show keyboard shortcuts help');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePanel]);

  return (
    <div className="h-screen flex bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-900/40 to-slate-900"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-grid-pattern opacity-5"></div>
      
      {/* Modern Floating Controls */}
      <div className="absolute top-6 left-6 z-50 flex items-center gap-2">
        <div className="flex items-center gap-1 bg-white/10 backdrop-blur-xl rounded-xl p-1 shadow-2xl border border-white/20">
          {DEFAULT_PANELS.map(panel => {
            const Icon = panel.icon;
            const currentPanel = panels.find(p => p.type === panel.type);
            const isVisible = currentPanel?.visible;
            
            return (
              <button
                key={panel.type}
                onClick={() => togglePanel(panel.type)}
                className={`group flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isVisible
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-105"
                    : "text-white/70 hover:text-white hover:bg-white/10 hover:scale-105"
                }`}
                title={`${panel.title} (${panel.type === 'chat' ? 'C' : 'F'})`}
                onKeyDown={(e) => {
                  if (e.key === 'c' || e.key === 'C') {
                    if (panel.type === 'chat') togglePanel('chat');
                  } else if (e.key === 'f' || e.key === 'F') {
                    if (panel.type === 'files-preview') togglePanel('files-preview');
                  }
                }}
              >
                <Icon className={`h-4 w-4 transition-transform duration-300 ${isVisible ? 'rotate-12' : 'group-hover:rotate-6'}`} />
                <span className="hidden sm:inline font-semibold">{panel.title}</span>
              </button>
            );
          })}
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center gap-1 bg-white/10 backdrop-blur-xl rounded-xl p-1 shadow-2xl border border-white/20">
          <button 
            onClick={() => setShowSyncSettings(!showSyncSettings)}
            className={`p-2.5 rounded-lg transition-all duration-300 hover:scale-105 ${
              showSyncSettings 
                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
            title="Sync Settings"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
          <button className="p-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300 hover:scale-105" title="Settings">
            <CogIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modern Project Info & Sync Status */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
        <SyncIndicator 
          workspaceId={workspaceId} 
          compact={true} 
          className="bg-white/10 backdrop-blur-xl shadow-2xl"
        />
        
        <div className="bg-white/10 backdrop-blur-xl rounded-xl px-4 py-2.5 shadow-2xl border border-white/20">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <div className="text-sm text-white font-mono font-medium truncate max-w-xs">
              {workingDirectory.split('/').pop() || workingDirectory}
            </div>
          </div>
        </div>
      </div>

      {/* Modern Content Layout */}
      <div className="flex-1 flex min-h-0 p-6 gap-6">
        {visiblePanels.length === 0 ? (
          <div className="flex-1 flex items-center justify-center bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl">
            <div className="text-center p-12">
              <div className="text-white/40 mb-6">
                <CogIcon className="h-20 w-20 mx-auto" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">No panels active</h3>
              <p className="text-white/60 text-lg">Click the panel buttons to show tools</p>
            </div>
          </div>
        ) : (
          visiblePanels.map((panel, index) => {

            return (
              <div
                key={panel.type}
                className="flex-1 min-h-0 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden transition-all duration-500 hover:shadow-3xl hover:border-white/30"
                style={{
                  animation: `slideInUp 0.6s ease-out ${index * 0.1}s both`
                }}
              >
                {panel.type === "chat" && (
                  <div className="h-full bg-gradient-to-b from-white/5 to-transparent rounded-2xl">
                    <ChatPage 
                      workingDirectory={workingDirectory} 
                      sessionId={sessionId} 
                    />
                  </div>
                )}
                
                {panel.type === "files-preview" && (
                  <div className="h-full bg-gradient-to-b from-white/5 to-transparent rounded-2xl">
                    <FilesPreviewToggle 
                      projectPath={workingDirectory}
                      sessionId={sessionId}
                      className="h-full"
                      onFileSelect={handleFileSelect}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sync Settings Sidebar */}
      {showSyncSettings && (
        <div className="absolute right-6 top-20 z-50 w-96 max-h-[calc(100vh-8rem)] overflow-y-auto">
          <SyncSettingsPanel
            workspaceId={workspaceId}
            onConfigChange={(config) => {
              console.log('Sync config updated:', config);
              // Here we could persist the config or update sync service
            }}
            className="shadow-2xl"
          />
        </div>
      )}
      
      {/* Overlay to close sync settings */}
      {showSyncSettings && (
        <div 
          className="absolute inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setShowSyncSettings(false)}
        />
      )}
    </div>
  );
}