import React, { createContext, useContext, useState, useEffect } from 'react';

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
  email: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  clone_url: string;
  ssh_url: string;
  html_url: string;
  updated_at: string;
  default_branch: string;
  language?: string;
  stargazers_count?: number;
  watchers_count?: number;
}

export interface GitHubContextType {
  isAuthenticated: boolean;
  user: GitHubUser | null;
  repositories: GitHubRepo[];
  loading: boolean;
  error: string | null;
  
  // OAuth authentication methods
  initiateOAuth: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  
  // Repository methods
  fetchRepositories: () => Promise<void>;
  createRepository: (name: string, description?: string, isPrivate?: boolean) => Promise<GitHubRepo>;
  
  // Project sync methods
  syncProject: (projectPath: string, repoName: string) => Promise<void>;
  autoCommitAndPush: (projectPath: string, message: string) => Promise<void>;
  getProjectRepo: (projectPath: string) => GitHubRepo | null;
}

const GitHubContext = createContext<GitHubContextType | undefined>(undefined);

export const useGitHub = () => {
  const context = useContext(GitHubContext);
  if (context === undefined) {
    throw new Error('useGitHub must be used within a GitHubProvider');
  }
  return context;
};

export const GitHubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const initiateOAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      // Initiate OAuth flow
      const response = await fetch('/auth/github');
      if (response.ok) {
        const data = await response.json();
        // Redirect to GitHub OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to initiate GitHub authentication');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start authentication');
    } finally {
      setLoading(false);
    }
  };

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/status');
      if (response.ok) {
        const data = await response.json();
        
        if (data.github.authenticated) {
          setUser(data.github.user);
          setIsAuthenticated(true);
          // Fetch repositories
          await fetchRepositories();
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check authentication');
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      
      // Call logout API
      await fetch('/api/auth/github/logout', { method: 'POST' });
      
      // Clear local state
      setUser(null);
      setIsAuthenticated(false);
      setRepositories([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to logout');
    } finally {
      setLoading(false);
    }
  };

  const fetchRepositories = async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      const response = await fetch('/api/github/repositories');

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const data = await response.json();
      setRepositories(data.repositories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  const createRepository = async (name: string, description?: string, isPrivate: boolean = false): Promise<GitHubRepo> => {
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      setLoading(true);
      const response = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          private: isPrivate,
          auto_init: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create repository');
      }

      const newRepo = await response.json();
      setRepositories(prev => [newRepo, ...prev]);
      return newRepo;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repository');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const syncProject = async (projectPath: string, repoName: string) => {
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      setLoading(true);
      
      // Call backend API to sync project with GitHub repo
      const response = await fetch('/api/github/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectPath,
          repoName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to sync project with GitHub');
      }

      // Store project-repo mapping
      const projectMappings = JSON.parse(localStorage.getItem('project_repo_mappings') || '{}');
      projectMappings[projectPath] = repoName;
      localStorage.setItem('project_repo_mappings', JSON.stringify(projectMappings));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync project');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const autoCommitAndPush = async (projectPath: string, message: string) => {
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch('/api/github/auto-commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectPath,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to auto-commit and push');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to auto-commit');
      throw err;
    }
  };

  const getProjectRepo = (projectPath: string): GitHubRepo | null => {
    const projectMappings = JSON.parse(localStorage.getItem('project_repo_mappings') || '{}');
    const repoName = projectMappings[projectPath];
    
    if (!repoName) return null;
    
    return repositories.find(repo => repo.name === repoName || repo.full_name === repoName) || null;
  };

  const contextValue: GitHubContextType = {
    isAuthenticated,
    user,
    repositories,
    loading,
    error,
    initiateOAuth,
    logout,
    checkAuthStatus,
    fetchRepositories,
    createRepository,
    syncProject,
    autoCommitAndPush,
    getProjectRepo,
  };

  return (
    <GitHubContext.Provider value={contextValue}>
      {children}
    </GitHubContext.Provider>
  );
};