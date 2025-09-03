import { useState, useEffect } from 'react';
import {
  CogIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  EyeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

export interface SyncConfig {
  workspaceId: string;
  autoCommit: boolean;
  autoSync: boolean;
  syncInterval: number;
  collaborationMode: boolean;
  commitMessage?: string;
}

export interface SyncStatus {
  workspaceId: string;
  isActive: boolean;
  lastSync: string;
  lastCommit: string;
  pendingChanges: number;
  conflictsDetected: boolean;
  syncError?: string;
}

interface SyncSettingsPanelProps {
  workspaceId: string;
  initialConfig?: Partial<SyncConfig>;
  onConfigChange: (config: SyncConfig) => void;
  className?: string;
}

export function SyncSettingsPanel({ 
  workspaceId, 
  initialConfig, 
  onConfigChange, 
  className = "" 
}: SyncSettingsPanelProps) {
  const [config, setConfig] = useState<SyncConfig>({
    workspaceId,
    autoCommit: initialConfig?.autoCommit ?? true,
    autoSync: initialConfig?.autoSync ?? true,
    syncInterval: initialConfig?.syncInterval ?? 30,
    collaborationMode: initialConfig?.collaborationMode ?? false,
    commitMessage: initialConfig?.commitMessage ?? ''
  });

  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState<{
    current: string;
    local: string[];
    remote: string[];
  } | null>(null);

  useEffect(() => {
    fetchSyncStatus();
    fetchBranches();
  }, [workspaceId]);

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch(`/api/sync/${workspaceId}/status`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await fetch(`/api/sync/${workspaceId}/branches`);
      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches);
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    }
  };

  const handleConfigUpdate = (updates: Partial<SyncConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleManualSync = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sync/${workspaceId}/pull`, {
        method: 'POST'
      });
      
      if (response.ok) {
        await fetchSyncStatus();
      } else {
        console.error('Manual sync failed');
      }
    } catch (error) {
      console.error('Manual sync error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualCommit = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sync/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          commitMessage: config.commitMessage || undefined
        })
      });
      
      if (response.ok) {
        await fetchSyncStatus();
      } else {
        console.error('Manual commit failed');
      }
    } catch (error) {
      console.error('Manual commit error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBranchSwitch = async (branchName: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sync/branch/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, branchName })
      });
      
      if (response.ok) {
        await fetchBranches();
      } else {
        console.error('Branch switch failed');
      }
    } catch (error) {
      console.error('Branch switch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBranch = async (branchName: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sync/branch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, branchName })
      });
      
      if (response.ok) {
        await fetchBranches();
      } else {
        console.error('Branch creation failed');
      }
    } catch (error) {
      console.error('Branch creation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
          <CogIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Sync Settings
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure real-time GitHub synchronization
          </p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Sync Status */}
        {status && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Sync Status
              </h3>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                status.isActive 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {status.isActive ? (
                  <>
                    <CheckCircleIcon className="h-4 w-4" />
                    Active
                  </>
                ) : (
                  <>
                    <XCircleIcon className="h-4 w-4" />
                    Inactive
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Last Sync:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatDate(status.lastSync)}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Pending Changes:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {status.pendingChanges}
                </p>
              </div>
            </div>

            {status.syncError && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700 dark:text-red-300">
                    {status.syncError}
                  </span>
                </div>
              </div>
            )}

            {status.conflictsDetected && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">
                    Merge conflicts detected. Manual resolution required.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Auto-Sync Settings */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Automatic Sync
          </h3>
          
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">
                  Auto-commit changes
                </span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Automatically commit file changes as you work
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.autoCommit}
                onChange={(e) => handleConfigUpdate({ autoCommit: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </label>

            <label className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">
                  Auto-sync with remote
                </span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Automatically pull changes from GitHub
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.autoSync}
                onChange={(e) => handleConfigUpdate({ autoSync: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </label>

            <label className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">
                  Collaboration mode
                </span>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enhanced conflict detection for team collaboration
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.collaborationMode}
                onChange={(e) => handleConfigUpdate({ collaborationMode: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </label>
          </div>

          {/* Sync Interval */}
          {config.autoSync && (
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Sync interval (seconds)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                value={config.syncInterval}
                onChange={(e) => handleConfigUpdate({ syncInterval: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          )}

          {/* Custom Commit Message */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Default commit message (optional)
            </label>
            <input
              type="text"
              value={config.commitMessage}
              onChange={(e) => handleConfigUpdate({ commitMessage: e.target.value })}
              placeholder="Auto-sync: Updated files"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        {/* Manual Actions */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Manual Actions
          </h3>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleManualSync}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Sync Now
            </button>

            <button
              onClick={handleManualCommit}
              disabled={isLoading || !status?.pendingChanges}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CloudArrowUpIcon className="h-4 w-4" />
              Commit & Push
            </button>
          </div>
        </div>

        {/* Branch Management */}
        {branches && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Branch Management
            </h3>
            
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Current branch:</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {branches.current}
              </p>
            </div>

            {branches.remote.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Switch to branch:
                </label>
                <select
                  onChange={(e) => e.target.value && handleBranchSwitch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select a branch...</option>
                  {branches.remote.map(branch => (
                    <option key={branch} value={branch} disabled={branch === branches.current}>
                      {branch} {branch === branches.current ? '(current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}