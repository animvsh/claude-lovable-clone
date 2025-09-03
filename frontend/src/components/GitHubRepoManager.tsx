import { useState, useEffect } from 'react';
import { useGitHub } from '../contexts/GitHubContext';
import type { ProjectInfo } from '../types';
import {
  FolderIcon,
  PlusIcon,
  LinkIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  GitBranchIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface GitHubRepoManagerProps {
  projects: ProjectInfo[];
  onRefresh?: () => void;
}

export function GitHubRepoManager({ projects, onRefresh }: GitHubRepoManagerProps) {
  const {
    isAuthenticated,
    repositories,
    loading,
    error,
    fetchRepositories,
    createRepository,
    syncProject,
    getProjectRepo,
  } = useGitHub();

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDescription, setNewRepoDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [showCreateRepo, setShowCreateRepo] = useState(false);
  const [syncingProjects, setSyncingProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isAuthenticated) {
      fetchRepositories();
    }
  }, [isAuthenticated, fetchRepositories]);

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim()) return;

    try {
      await createRepository(newRepoName.trim(), newRepoDescription.trim(), isPrivate);
      setNewRepoName('');
      setNewRepoDescription('');
      setShowCreateRepo(false);
      setSelectedRepo(newRepoName.trim());
    } catch (err) {
      console.error('Failed to create repository:', err);
    }
  };

  const handleSyncProject = async (projectPath: string, repoName: string) => {
    if (!repoName) return;

    try {
      setSyncingProjects(prev => new Set([...prev, projectPath]));
      await syncProject(projectPath, repoName);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to sync project:', err);
    } finally {
      setSyncingProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectPath);
        return newSet;
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-8">
        <div className="text-white/60 mb-4">
          <GitBranchIcon className="w-16 h-16 mx-auto" />
        </div>
        <h3 className="text-white text-lg font-semibold mb-2">Connect to GitHub</h3>
        <p className="text-white/70 text-sm">
          Connect your GitHub account to manage repository syncing
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-xl font-bold">GitHub Repository Manager</h2>
          <p className="text-white/70 text-sm mt-1">
            Sync your projects with GitHub repositories
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchRepositories}
            disabled={loading}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl transition-all duration-300 hover:scale-105 disabled:opacity-50"
            title="Refresh repositories"
          >
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateRepo(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <PlusIcon className="w-4 h-4" />
            New Repo
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-3">
          <ExclamationCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Create Repository Modal */}
      {showCreateRepo && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-white text-lg font-bold mb-4">Create New Repository</h3>
            
            <form onSubmit={handleCreateRepo} className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Repository Name
                </label>
                <input
                  type="text"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  placeholder="my-awesome-project"
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newRepoDescription}
                  onChange={(e) => setNewRepoDescription(e.target.value)}
                  placeholder="A brief description of your project"
                  rows={3}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="private"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-white/10 border border-white/20 rounded focus:ring-blue-500"
                />
                <label htmlFor="private" className="text-white/80 text-sm flex items-center gap-2">
                  {isPrivate ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  Private repository
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateRepo(false);
                    setNewRepoName('');
                    setNewRepoDescription('');
                    setIsPrivate(false);
                  }}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newRepoName.trim()}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project-Repository Sync */}
      <div className="grid gap-4">
        {projects.map((project) => {
          const linkedRepo = getProjectRepo(project.path);
          const isSyncing = syncingProjects.has(project.path);
          
          return (
            <div
              key={project.path}
              className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FolderIcon className="w-6 h-6 text-white/80 flex-shrink-0" />
                  <div>
                    <h3 className="text-white font-semibold">
                      {project.path.split('/').pop() || project.path}
                    </h3>
                    <p className="text-white/60 text-sm font-mono">{project.path}</p>
                  </div>
                </div>
                
                {linkedRepo && (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircleIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Synced</span>
                  </div>
                )}
              </div>

              {linkedRepo ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <GitBranchIcon className="w-4 h-4 text-white/70" />
                      <span className="text-white font-medium">{linkedRepo.full_name}</span>
                      {linkedRepo.private && <EyeSlashIcon className="w-4 h-4 text-white/50" />}
                    </div>
                    <a
                      href={linkedRepo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      View on GitHub →
                    </a>
                  </div>
                  {linkedRepo.description && (
                    <p className="text-white/70 text-sm mb-2">{linkedRepo.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-white/50">
                    <span className="flex items-center gap-1">
                      <ClockIcon className="w-3 h-3" />
                      Updated {formatDate(linkedRepo.updated_at)}
                    </span>
                    <span>Default: {linkedRepo.default_branch}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedProject === project.path ? selectedRepo : ''}
                      onChange={(e) => {
                        setSelectedProject(project.path);
                        setSelectedRepo(e.target.value);
                      }}
                      className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a repository...</option>
                      {repositories.map((repo) => (
                        <option key={repo.id} value={repo.name} className="bg-slate-800">
                          {repo.full_name} {repo.private ? '(Private)' : ''}
                        </option>
                      ))}
                    </select>
                    
                    <button
                      onClick={() => handleSyncProject(project.path, selectedRepo)}
                      disabled={!selectedRepo || isSyncing}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSyncing ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <LinkIcon className="w-4 h-4" />
                          Sync
                        </>
                      )}
                    </button>
                  </div>
                  
                  <p className="text-white/60 text-xs">
                    Link this project to a GitHub repository for automatic syncing
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-8">
          <FolderIcon className="w-16 h-16 text-white/40 mx-auto mb-4" />
          <p className="text-white/60">No projects found</p>
        </div>
      )}
    </div>
  );
}