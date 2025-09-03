import { useState } from 'react';
import { useGitHub } from '../contexts/GitHubContext';
import {
  UserIcon,
  KeyIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowRightEndOnRectangleIcon,
  ArrowLeftEndOnRectangleIcon,
} from '@heroicons/react/24/outline';

export function GitHubAuth() {
  const { isAuthenticated, user, loading, error, login, logout } = useGitHub();
  const [token, setToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      await login(token.trim());
      setToken('');
      setShowTokenInput(false);
    }
  };

  const handleLogout = () => {
    logout();
    setShowTokenInput(false);
  };

  if (isAuthenticated && user) {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img
              src={user.avatar_url}
              alt={user.name || user.login}
              className="w-12 h-12 rounded-full border-2 border-white/30"
            />
            <div>
              <h3 className="text-white font-semibold text-lg">{user.name || user.login}</h3>
              <p className="text-white/70 text-sm">@{user.login}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-green-400" />
            <span className="text-green-400 text-sm font-medium">Connected</span>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-xl transition-all duration-300 hover:scale-105"
        >
          <ArrowRightEndOnRectangleIcon className="w-5 h-5" />
          Disconnect GitHub
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-2xl">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-white/10 rounded-full">
            <UserIcon className="w-8 h-8 text-white/80" />
          </div>
        </div>
        <h3 className="text-white text-xl font-bold mb-2">Connect to GitHub</h3>
        <p className="text-white/70 text-sm">
          Connect your GitHub account to automatically sync projects with repositories
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-2">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {!showTokenInput ? (
        <div className="space-y-4">
          <button
            onClick={() => setShowTokenInput(true)}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <ArrowLeftEndOnRectangleIcon className="w-5 h-5" />
            Connect with Personal Access Token
          </button>
          
          <div className="text-center">
            <a
              href="https://github.com/settings/tokens/new?scopes=repo,user,workflow"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:text-blue-200 text-sm underline transition-colors"
            >
              Create a GitHub Personal Access Token →
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-white/80 mb-2">
              GitHub Personal Access Token
            </label>
            <div className="relative">
              <KeyIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                required
              />
            </div>
            <p className="mt-2 text-xs text-white/60">
              Required scopes: <code className="bg-black/30 px-1 rounded">repo</code>, <code className="bg-black/30 px-1 rounded">user</code>, <code className="bg-black/30 px-1 rounded">workflow</code>
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setShowTokenInput(false);
                setToken('');
              }}
              className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 rounded-xl transition-all duration-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <h4 className="text-blue-300 font-semibold text-sm mb-2">What you'll get:</h4>
        <ul className="text-blue-200 text-xs space-y-1">
          <li>• Automatic project-to-repository syncing</li>
          <li>• Auto-commit and push changes</li>
          <li>• Repository management from the UI</li>
          <li>• Seamless Git workflow integration</li>
        </ul>
      </div>
    </div>
  );
}