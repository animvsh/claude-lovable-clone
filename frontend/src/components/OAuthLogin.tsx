import { useState, useEffect } from 'react';
import {
  CodeBracketSquareIcon,
  SparklesIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

export interface AuthStatus {
  github: {
    authenticated: boolean;
    user?: {
      login: string;
      name: string;
      avatar_url: string;
      email: string;
    };
    sessionId?: string;
  };
  claude: {
    authenticated: boolean;
    user?: {
      id: string;
      email: string;
      name: string;
    };
    sessionId?: string;
  };
}

interface OAuthLoginProps {
  onAuthComplete?: (authStatus: AuthStatus) => void;
  className?: string;
}

export function OAuthLogin({ onAuthComplete, className = "" }: OAuthLoginProps) {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/status');
      
      if (response.ok) {
        const data = await response.json();
        setAuthStatus(data);
        
        if (onAuthComplete) {
          onAuthComplete(data);
        }
      } else {
        throw new Error('Failed to check authentication status');
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      setError('Failed to check authentication status');
    } finally {
      setIsLoading(false);
    }
  };

  const initiateGitHubAuth = async () => {
    try {
      setError(null);
      const response = await fetch('/auth/github');
      
      if (response.ok) {
        const data = await response.json();
        // Redirect to GitHub OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to initiate GitHub authentication');
      }
    } catch (error) {
      console.error('GitHub auth failed:', error);
      setError('Failed to start GitHub authentication');
    }
  };

  const initiateClaudeAuth = async () => {
    try {
      setError(null);
      const response = await fetch('/auth/claude');
      
      if (response.ok) {
        const data = await response.json();
        // Redirect to Claude OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to initiate Claude authentication');
      }
    } catch (error) {
      console.error('Claude auth failed:', error);
      setError('Failed to start Claude authentication');
    }
  };

  const handleLogout = async (provider: 'github' | 'claude') => {
    try {
      const response = await fetch(`/api/auth/${provider}/logout`, {
        method: 'POST',
      });
      
      if (response.ok) {
        await checkAuthStatus();
      } else {
        throw new Error(`Failed to logout from ${provider}`);
      }
    } catch (error) {
      console.error(`${provider} logout failed:`, error);
      setError(`Failed to logout from ${provider}`);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600 dark:text-gray-400">Checking authentication status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-2xl mx-auto ${className}`}>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl">
            <SparklesIcon className="h-10 w-10 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Connect Your Accounts
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
          Connect GitHub for repository access and Claude for AI development assistance - no tokens required!
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Auth Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* GitHub Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gray-900 rounded-xl">
                <CodeBracketSquareIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">GitHub</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Repository access & sync
                </p>
              </div>
            </div>

            {authStatus?.github.authenticated ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  <div className="flex-1">
                    <p className="font-medium text-green-700 dark:text-green-300">
                      Connected as {authStatus.github.user?.login}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {authStatus.github.user?.email}
                    </p>
                  </div>
                  {authStatus.github.user?.avatar_url && (
                    <img
                      src={authStatus.github.user.avatar_url}
                      alt="GitHub avatar"
                      className="h-8 w-8 rounded-full"
                    />
                  )}
                </div>
                
                <button
                  onClick={() => handleLogout('github')}
                  className="w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Disconnect GitHub
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Connect your GitHub account to access repositories, manage branches, and sync code automatically.
                </p>
                
                <button
                  onClick={initiateGitHubAuth}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors"
                >
                  Connect GitHub
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Claude Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                <SparklesIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Claude</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  AI development assistant
                </p>
              </div>
            </div>

            {authStatus?.claude.authenticated ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <CheckCircleIcon className="h-5 w-5 text-blue-500" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-700 dark:text-blue-300">
                      Connected
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      {authStatus.claude.user?.email}
                    </p>
                  </div>
                  <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <SparklesIcon className="h-4 w-4 text-white" />
                  </div>
                </div>
                
                <button
                  onClick={() => handleLogout('claude')}
                  className="w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Disconnect Claude
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Connect Claude for intelligent code assistance, debugging help, and automated development workflows.
                </p>
                
                <button
                  onClick={initiateClaudeAuth}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300"
                >
                  Connect Claude
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Next Steps */}
      {authStatus?.github.authenticated && authStatus?.claude.authenticated && (
        <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-2xl border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircleIcon className="h-6 w-6 text-green-500" />
            <h3 className="font-bold text-gray-900 dark:text-white">
              All Set! 🎉
            </h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Both accounts are connected. You can now:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>Browse and clone your GitHub repositories</li>
            <li>Use Claude for intelligent code assistance</li>
            <li>Automatic real-time sync between local changes and GitHub</li>
            <li>Collaborative development with conflict resolution</li>
          </ul>
        </div>
      )}

      {/* Refresh Button */}
      <div className="mt-6 text-center">
        <button
          onClick={checkAuthStatus}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4 inline mr-2" />
          Refresh Status
        </button>
      </div>
    </div>
  );
}