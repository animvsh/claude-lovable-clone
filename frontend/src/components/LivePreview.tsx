import { useEffect, useRef, useState, useCallback } from "react";
import { 
  PlayIcon, 
  PauseIcon, 
  ArrowPathIcon,
  ExclamationTriangleIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  DeviceTabletIcon,
  EyeIcon
} from "@heroicons/react/24/outline";
import { useLivePreview } from "../hooks/useLivePreview";

export interface LivePreviewProps {
  projectPath: string;
  sessionId: string;
  className?: string;
}

type ViewportSize = {
  width: number;
  height: number;
  label: string;
};

const VIEWPORT_PRESETS: ViewportSize[] = [
  { width: 1440, height: 900, label: "Desktop" },
  { width: 768, height: 1024, label: "Tablet" },
  { width: 375, height: 812, label: "Mobile" },
  { width: 1200, height: 800, label: "Custom" },
];

export function LivePreview({ projectPath, sessionId, className = "" }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentViewport, setCurrentViewport] = useState<ViewportSize>(VIEWPORT_PRESETS[0]);
  const [previewUrl] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  
  const {
    isConnected,
    isWatching,
    lastChange,
    buildStatus,
    error,
    connect,
    disconnect,
    startWatching,
    stopWatching,
    refreshPreview,
  } = useLivePreview();

  // Auto-connect when component mounts (only if user explicitly wants live preview)
  useEffect(() => {
    // Don't auto-connect to prevent errors for projects that don't need live preview
    // User can manually connect if needed
    return () => {
      if (isConnected) {
        disconnect();
      }
    };
  }, [isConnected, disconnect]);

  // Auto-refresh iframe when files change
  useEffect(() => {
    if (lastChange && buildStatus === 'success' && iframeRef.current) {
      // Small delay to ensure build is complete
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = iframeRef.current.src;
        }
      }, 500);
    }
  }, [lastChange, buildStatus]);

  const handleToggleWatching = useCallback(() => {
    if (isWatching) {
      stopWatching(sessionId);
    } else {
      startWatching(sessionId, projectPath);
    }
  }, [isWatching, sessionId, projectPath, startWatching, stopWatching]);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
    refreshPreview();
  }, [refreshPreview]);

  const handleViewportChange = useCallback((viewport: ViewportSize) => {
    setCurrentViewport(viewport);
  }, []);

  const getViewportIcon = (viewport: ViewportSize) => {
    if (viewport.width <= 480) {
      return <DevicePhoneMobileIcon className="h-4 w-4" />;
    } else if (viewport.width <= 768) {
      return <DeviceTabletIcon className="h-4 w-4" />;
    } else {
      return <ComputerDesktopIcon className="h-4 w-4" />;
    }
  };


  const getStatusText = () => {
    if (error) return "Error";
    if (buildStatus === 'building') return "Building...";
    if (buildStatus === 'error') return "Build Error";
    if (isWatching && buildStatus === 'success') return "Live";
    if (isWatching) return "Watching";
    return "Stopped";
  };

  return (
    <div className={`flex flex-col h-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl ${className}`}>
      {/* Modern Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/20 bg-gradient-to-r from-white/10 to-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-white/50'} animate-pulse`} />
            <span className={`text-sm font-semibold text-white`}>
              {getStatusText()}
            </span>
          </div>
          
          {lastChange && (
            <div className="text-xs text-white/70">
              Last: {lastChange.path} ({lastChange.type})
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Modern Viewport selector */}
          <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 p-1">
            {VIEWPORT_PRESETS.map((viewport) => (
              <button
                key={`${viewport.width}x${viewport.height}`}
                onClick={() => handleViewportChange(viewport)}
                className={`px-3 py-2 text-xs rounded-lg flex items-center gap-2 transition-all duration-300 font-medium ${
                  currentViewport === viewport
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg scale-105"
                    : "text-white/80 hover:text-white hover:bg-white/10 hover:scale-105"
                }`}
                title={`${viewport.label} (${viewport.width}x${viewport.height})`}
              >
                {getViewportIcon(viewport)}
                {viewport.label}
              </button>
            ))}
          </div>

          {/* Modern Control buttons */}
          <button
            onClick={handleToggleWatching}
            disabled={isConnecting || !isConnected}
            className="p-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg"
            title={isWatching ? "Stop watching" : "Start watching"}
          >
            {isWatching ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={handleRefresh}
            disabled={!isConnected}
            className="p-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:rotate-180"
            title="Refresh preview"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modern Preview content */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent">
        {error ? (
          <div className="flex flex-col items-center gap-4 text-center p-8 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-2xl">
            <ExclamationTriangleIcon className="h-16 w-16 text-red-400" />
            <div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Preview Error
              </h3>
              <p className="text-sm text-white/70 max-w-md">
                {error}
              </p>
            </div>
            <button
              onClick={() => connect()}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all duration-300 hover:scale-105"
            >
              Retry Connection
            </button>
          </div>
        ) : !isConnected ? (
          <div className="flex flex-col items-center gap-6 text-center p-10 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-2xl max-w-md">
            {isConnecting ? (
              <>
                <div className="w-12 h-12 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                <div className="text-sm text-white/80 font-medium">
                  Connecting to live preview...
                </div>
              </>
            ) : (
              <>
                <EyeIcon className="h-20 w-20 text-white/60" />
                <div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    Live Preview
                  </h3>
                  <p className="text-sm text-white/70 max-w-md mb-6">
                    Connect to see real-time updates of your project. Perfect for web development with hot reload.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsConnecting(true);
                    connect()
                      .then(() => startWatching(sessionId, projectPath))
                      .catch(console.error)
                      .finally(() => setIsConnecting(false));
                  }}
                  className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl text-sm font-semibold hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  Connect Live Preview
                </button>
                <div className="text-xs text-white/60 max-w-xs">
                  Optional: Only needed for web projects with development servers
                </div>
              </>
            )}
          </div>
        ) : !previewUrl ? (
          <div className="text-center p-8 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-2xl max-w-md">
            <div className="text-xl font-semibold text-white mb-3">
              No Preview Available
            </div>
            <p className="text-sm text-white/70 max-w-md mb-6">
              Start a development server in your project to see a live preview here.
            </p>
            <div className="mt-4 text-xs text-white/60 font-mono bg-black/30 px-4 py-2 rounded-lg">
              Try: npm run dev, npm start, or yarn dev
            </div>
          </div>
        ) : (
          <div 
            className="bg-white/20 backdrop-blur-xl rounded-2xl border border-white/30 shadow-2xl overflow-hidden transition-all duration-500 hover:shadow-3xl"
            style={{
              width: Math.min(currentViewport.width, window.innerWidth - 100),
              height: Math.min(currentViewport.height, window.innerHeight - 200),
              maxWidth: "100%",
              maxHeight: "100%"
            }}
          >
            <iframe
              ref={iframeRef}
              src={previewUrl}
              className="w-full h-full border-0 rounded-2xl"
              title="Live Preview"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            />
          </div>
        )}
      </div>

      {/* Build status footer */}
      {buildStatus === 'error' && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-red-800 dark:text-red-200">
                Build failed
              </div>
              <div className="text-xs text-red-600 dark:text-red-300 mt-1 font-mono">
                Check the console for details
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}