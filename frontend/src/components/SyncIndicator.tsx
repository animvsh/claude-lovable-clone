import { useState, useEffect } from 'react';
import {
  CloudArrowUpIcon,
  CloudArrowDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { SyncStatus } from './SyncSettingsPanel';

interface SyncIndicatorProps {
  workspaceId: string;
  className?: string;
  compact?: boolean;
}

export function SyncIndicator({ workspaceId, className = "", compact = false }: SyncIndicatorProps) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [lastActivity, setLastActivity] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/sync/${workspaceId}/status`);
        if (response.ok) {
          const data = await response.json();
          setStatus(data.status);
          setLastActivity(getActivityMessage(data.status));
        }
      } catch (error) {
        console.error('Failed to fetch sync status:', error);
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll for status updates every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  const getActivityMessage = (status: SyncStatus): string => {
    if (status.syncError) {
      return 'Sync failed';
    }
    
    if (status.conflictsDetected) {
      return 'Conflicts detected';
    }

    if (status.pendingChanges > 0) {
      return `${status.pendingChanges} pending change${status.pendingChanges === 1 ? '' : 's'}`;
    }

    if (status.lastSync) {
      const lastSync = new Date(status.lastSync);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - lastSync.getTime()) / 60000);
      
      if (diffMinutes < 1) {
        return 'Just synced';
      } else if (diffMinutes < 60) {
        return `Synced ${diffMinutes}m ago`;
      } else {
        const diffHours = Math.floor(diffMinutes / 60);
        return `Synced ${diffHours}h ago`;
      }
    }

    return 'No recent activity';
  };

  const getStatusIcon = () => {
    if (!status) {
      return <ClockIcon className="h-4 w-4 text-gray-400 animate-pulse" />;
    }

    if (status.syncError) {
      return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
    }

    if (status.conflictsDetected) {
      return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />;
    }

    if (status.pendingChanges > 0) {
      return <CloudArrowUpIcon className="h-4 w-4 text-blue-500 animate-pulse" />;
    }

    return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
  };

  const getStatusColor = () => {
    if (!status) return 'border-gray-200 bg-gray-50';
    
    if (status.syncError) {
      return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
    }

    if (status.conflictsDetected) {
      return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20';
    }

    if (status.pendingChanges > 0) {
      return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20';
    }

    return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/sync/${workspaceId}/status`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data.status);
        setLastActivity(getActivityMessage(data.status));
      }
    } catch (error) {
      console.error('Failed to refresh sync status:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!status && compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 ${className}`}>
        <ClockIcon className="h-4 w-4 text-gray-400 animate-pulse" />
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getStatusColor()} ${className}`}>
        {getStatusIcon()}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {lastActivity}
        </span>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="ml-auto p-1 hover:bg-white/50 rounded transition-colors"
        >
          <ArrowPathIcon className={`h-3 w-3 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${getStatusColor()}`}>
            {getStatusIcon()}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Sync Status
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {lastActivity}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowPathIcon className={`h-5 w-5 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status Details */}
      {status && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Status:</span>
              <p className={`font-medium ${
                status.isActive 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {status.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
            
            <div>
              <span className="text-gray-500 dark:text-gray-400">Changes:</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {status.pendingChanges}
              </p>
            </div>
          </div>

          {status.lastSync && (
            <div className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">Last sync:</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {new Date(status.lastSync).toLocaleString()}
              </p>
            </div>
          )}

          {status.lastCommit && (
            <div className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">Last commit:</span>
              <p className="font-medium font-mono text-gray-900 dark:text-white">
                {status.lastCommit.substring(0, 8)}
              </p>
            </div>
          )}

          {status.syncError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">
                    Sync Error
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {status.syncError}
                  </p>
                </div>
              </div>
            </div>
          )}

          {status.conflictsDetected && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                    Conflicts Detected
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    Manual resolution required before sync can continue
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}