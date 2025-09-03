import { useState, useEffect } from 'react';
import { useGitHub } from '../contexts/GitHubContext';
import type { GitHubRepo } from '../contexts/GitHubContext';
import {
  FolderIcon,
  MagnifyingGlassIcon,
  StarIcon as StarIconOutline,
  EyeIcon,
  CalendarIcon,
  ArrowRightIcon,
  RocketLaunchIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface GitHubRepositoryBrowserProps {
  onRepositorySelect: (repo: GitHubRepo) => Promise<void>;
  className?: string;
}

export function GitHubRepositoryBrowser({ onRepositorySelect, className = "" }: GitHubRepositoryBrowserProps) {
  const { repositories, loading, error, fetchRepositories } = useGitHub();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'stars'>('updated');
  const [filterBy, setFilterBy] = useState<'all' | 'public' | 'private'>('all');
  const [initializingRepo, setInitializingRepo] = useState<string | null>(null);

  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  const handleRepositorySelect = async (repo: GitHubRepo) => {
    try {
      setInitializingRepo(repo.id.toString());
      await onRepositorySelect(repo);
    } catch (error) {
      console.error('Failed to initialize repository:', error);
    } finally {
      setInitializingRepo(null);
    }
  };

  const filteredAndSortedRepos = repositories
    .filter(repo => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return repo.name.toLowerCase().includes(query) ||
               repo.description?.toLowerCase().includes(query) ||
               repo.full_name.toLowerCase().includes(query);
      }
      return true;
    })
    .filter(repo => {
      // Privacy filter
      if (filterBy === 'public') return !repo.private;
      if (filterBy === 'private') return repo.private;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'stars':
          return (b.stargazers_count || 0) - (a.stargazers_count || 0);
        case 'updated':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const getLanguageColor = (language: string) => {
    const colors: Record<string, string> = {
      JavaScript: 'bg-yellow-500',
      TypeScript: 'bg-blue-500',
      Python: 'bg-green-500',
      Java: 'bg-orange-500',
      'C++': 'bg-blue-600',
      Go: 'bg-cyan-500',
      Rust: 'bg-orange-600',
      PHP: 'bg-purple-500',
      Ruby: 'bg-red-500',
      Swift: 'bg-orange-400',
    };
    return colors[language] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70">Loading repositories...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <ExclamationTriangleIcon className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h3 className="text-white text-lg font-semibold mb-2">Failed to load repositories</h3>
        <p className="text-white/70 mb-4">{error}</p>
        <button
          onClick={fetchRepositories}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
            <FolderIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white">
            Choose Repository
          </h1>
        </div>
        <p className="text-lg text-white/70 max-w-2xl mx-auto">
          Select a GitHub repository to start developing with Claude
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search repositories..."
              className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="updated" className="bg-gray-800">Recently Updated</option>
            <option value="name" className="bg-gray-800">Name</option>
            <option value="stars" className="bg-gray-800">Stars</option>
          </select>

          {/* Filter */}
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as any)}
            className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all" className="bg-gray-800">All Repositories</option>
            <option value="public" className="bg-gray-800">Public</option>
            <option value="private" className="bg-gray-800">Private</option>
          </select>
        </div>
      </div>

      {/* Repository List */}
      <div className="grid gap-4">
        {filteredAndSortedRepos.length === 0 ? (
          <div className="text-center py-20">
            <FolderIcon className="w-16 h-16 text-white/40 mx-auto mb-4" />
            <p className="text-white/70">No repositories found</p>
          </div>
        ) : (
          filteredAndSortedRepos.map((repo) => {
            const isInitializing = initializingRepo === repo.id.toString();
            
            return (
              <div
                key={repo.id}
                className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-2xl hover:shadow-3xl hover:border-white/30 transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  {/* Repository Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-semibold text-white truncate">
                        {repo.name}
                      </h3>
                      {repo.private && (
                        <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-300 rounded-full border border-yellow-500/30">
                          Private
                        </span>
                      )}
                      {repo.language && (
                        <div className="flex items-center gap-1">
                          <div className={`w-3 h-3 rounded-full ${getLanguageColor(repo.language)}`} />
                          <span className="text-sm text-white/70">{repo.language}</span>
                        </div>
                      )}
                    </div>

                    {repo.description && (
                      <p className="text-white/70 mb-4 line-clamp-2">
                        {repo.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-white/60">
                      {repo.stargazers_count !== undefined && (
                        <div className="flex items-center gap-1">
                          <StarIconOutline className="w-4 h-4" />
                          {repo.stargazers_count}
                        </div>
                      )}
                      {repo.watchers_count !== undefined && (
                        <div className="flex items-center gap-1">
                          <EyeIcon className="w-4 h-4" />
                          {repo.watchers_count}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" />
                        Updated {formatDate(repo.updated_at)}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleRepositorySelect(repo)}
                    disabled={isInitializing}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isInitializing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      <>
                        <RocketLaunchIcon className="w-5 h-5" />
                        Start Developing
                        <ArrowRightIcon className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}