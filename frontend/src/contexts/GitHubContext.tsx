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
}

export interface GitHubContextType {
  isAuthenticated: boolean;
  user: GitHubUser | null;
  repositories: GitHubRepo[];
  accessToken: string | null;
  loading: boolean;
  error: string | null;
  
  // Authentication methods
  login: (token: string) => Promise<void>;
  logout: () => void;
  
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
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load token from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('github_access_token');
    if (token) {
      login(token);
    }
  }, []);

  const login = async (token: string) => {
    try {
      setLoading(true);
      setError(null);

      // Validate token by fetching user info
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!userResponse.ok) {
        throw new Error('Invalid GitHub token');
      }

      const userData = await userResponse.json();
      
      // Store token and user data
      localStorage.setItem('github_access_token', token);
      setAccessToken(token);
      setUser(userData);
      setIsAuthenticated(true);

      // Fetch repositories
      await fetchRepositories(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to authenticate');
      setIsAuthenticated(false);
      setUser(null);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('github_access_token');
    setAccessToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setRepositories([]);
    setError(null);
  };

  const fetchRepositories = async (token?: string) => {
    const currentToken = token || accessToken;
    if (!currentToken) return;

    try {
      setLoading(true);
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: {
          'Authorization': `token ${currentToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const repos = await response.json();
      setRepositories(repos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  const createRepository = async (name: string, description?: string, isPrivate: boolean = false): Promise<GitHubRepo> => {
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      setLoading(true);
      const response = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `token ${accessToken}`,
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
    if (!accessToken) {
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
          accessToken,
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
    if (!accessToken) {
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
          accessToken,
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
    accessToken,
    loading,
    error,
    login,
    logout,
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