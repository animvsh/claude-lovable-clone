import { useState, useRef, useCallback, useEffect } from "react";

export interface FileChange {
  path: string;
  type: "added" | "changed" | "removed";
  timestamp: number;
}

export type BuildStatus = "idle" | "building" | "success" | "error";

export interface LivePreviewState {
  isConnected: boolean;
  isWatching: boolean;
  lastChange: FileChange | null;
  buildStatus: BuildStatus;
  error: string | null;
  activeSessions: string[];
}

export function useLivePreview() {
  const [state, setState] = useState<LivePreviewState>({
    isConnected: false,
    isWatching: false,
    lastChange: null,
    buildStatus: "idle",
    error: null,
    activeSessions: [],
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // WebSocket connection management
  const connect = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      try {
        // Get WebSocket URL (adjust based on current location)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log("WebSocket connected for live preview");
          setState(prev => ({ ...prev, isConnected: true, error: null }));
          reconnectAttempts.current = 0;
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        ws.onclose = (event) => {
          console.log("WebSocket disconnected:", event.code, event.reason);
          setState(prev => ({ 
            ...prev, 
            isConnected: false,
            isWatching: false,
          }));

          // Attempt to reconnect if not manually closed
          if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttempts.current++;
              connect().catch(console.error);
            }, delay);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setState(prev => ({ 
            ...prev, 
            error: "WebSocket connection failed",
            isConnected: false,
          }));
          reject(new Error("WebSocket connection failed"));
        };

        wsRef.current = ws;

      } catch (error) {
        setState(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : "Connection failed",
        }));
        reject(error);
      }
    });
  }, []);

  const disconnect = useCallback((): void => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }

    setState(prev => ({ 
      ...prev, 
      isConnected: false,
      isWatching: false,
    }));
  }, []);

  // File watching controls
  const startWatching = useCallback((sessionId: string, projectPath: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setState(prev => ({ ...prev, error: "WebSocket not connected" }));
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'start_watching',
      sessionId,
      projectPath,
    }));
  }, []);

  const stopWatching = useCallback((sessionId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'stop_watching',
      sessionId,
    }));
  }, []);

  const refreshPreview = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'ping',
    }));
  }, []);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'connection_established':
        setState(prev => ({ ...prev, isConnected: true, error: null }));
        break;

      case 'watch_started':
        setState(prev => ({ 
          ...prev, 
          isWatching: true,
          error: null,
        }));
        break;

      case 'watch_stopped':
        setState(prev => ({ ...prev, isWatching: false }));
        break;

      case 'watch_error':
        setState(prev => ({ 
          ...prev, 
          error: data.error,
          isWatching: false,
        }));
        break;

      case 'file_change':
        setState(prev => ({ 
          ...prev, 
          lastChange: data.change,
          buildStatus: "building",
        }));
        break;

      case 'build_success':
        setState(prev => ({ 
          ...prev, 
          buildStatus: "success",
        }));
        break;

      case 'build_error':
        setState(prev => ({ 
          ...prev, 
          buildStatus: "error",
          error: data.error,
        }));
        break;

      case 'build_started':
        setState(prev => ({ 
          ...prev, 
          buildStatus: "building",
        }));
        break;

      case 'active_sessions':
        setState(prev => ({ 
          ...prev, 
          activeSessions: data.sessions || [],
        }));
        break;

      case 'live_preview_response':
        // Handle preview URL updates if provided
        break;

      case 'pong':
        // Heartbeat response
        break;

      case 'error':
        setState(prev => ({ 
          ...prev, 
          error: data.error,
        }));
        break;

      default:
        console.log("Unknown WebSocket message type:", data.type);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Auto-detect development server
  const detectDevServer = useCallback(async (_projectPath: string): Promise<string | null> => {
    // Common development server ports to check
    const commonPorts = [3000, 3001, 4000, 5000, 5173, 8080, 8000];
    
    for (const port of commonPorts) {
      try {
        const url = `http://localhost:${port}`;
        await fetch(url, { 
          method: 'HEAD',
          mode: 'no-cors',
        });
        
        // If we get any response, assume the server is running
        return url;
      } catch (error) {
        // Continue to next port
      }
    }

    return null;
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    startWatching,
    stopWatching,
    refreshPreview,
    detectDevServer,
  };
}