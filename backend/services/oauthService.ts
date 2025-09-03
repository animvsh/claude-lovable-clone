import { randomBytes } from "crypto";
import { logger } from "../utils/logger.js";

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface ClaudeOAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthState {
  state: string;
  provider: 'github' | 'claude';
  timestamp: number;
  returnUrl?: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface ClaudeUser {
  id: string;
  email: string;
  name: string;
}

export interface ClaudeTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export interface UserSession {
  sessionId: string;
  userId: string;
  provider: 'github' | 'claude';
  accessToken: string;
  refreshToken?: string;
  userInfo: GitHubUser | ClaudeUser;
  createdAt: Date;
  expiresAt?: Date;
}

export class OAuthService {
  private githubConfig: GitHubOAuthConfig;
  private claudeConfig: ClaudeOAuthConfig;
  private pendingStates = new Map<string, OAuthState>();
  private userSessions = new Map<string, UserSession>();

  constructor() {
    // Load from environment variables
    this.githubConfig = {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:8080/auth/github/callback',
      scopes: ['repo', 'user:email', 'workflow']
    };

    this.claudeConfig = {
      clientId: process.env.CLAUDE_CLIENT_ID || '',
      clientSecret: process.env.CLAUDE_CLIENT_SECRET || '',
      redirectUri: process.env.CLAUDE_REDIRECT_URI || 'http://localhost:8080/auth/claude/callback',
      scopes: ['read', 'write']
    };

    // Cleanup expired sessions every hour
    setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000);
  }

  /**
   * Generate GitHub OAuth authorization URL
   */
  generateGitHubAuthUrl(returnUrl?: string): string {
    if (!this.githubConfig.clientId) {
      throw new Error('GitHub OAuth not configured - missing GITHUB_CLIENT_ID');
    }

    const state = this.generateState('github', returnUrl);
    
    const params = new URLSearchParams({
      client_id: this.githubConfig.clientId,
      redirect_uri: this.githubConfig.redirectUri,
      scope: this.githubConfig.scopes.join(' '),
      state,
      allow_signup: 'true'
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Generate Claude OAuth authorization URL
   */
  generateClaudeAuthUrl(returnUrl?: string): string {
    if (!this.claudeConfig.clientId) {
      throw new Error('Claude OAuth not configured - missing CLAUDE_CLIENT_ID');
    }

    const state = this.generateState('claude', returnUrl);
    
    const params = new URLSearchParams({
      client_id: this.claudeConfig.clientId,
      redirect_uri: this.claudeConfig.redirectUri,
      scope: this.claudeConfig.scopes.join(' '),
      state,
      response_type: 'code'
    });

    return `https://api.anthropic.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Handle GitHub OAuth callback
   */
  async handleGitHubCallback(code: string, state: string): Promise<UserSession> {
    const stateData = this.validateState(state, 'github');
    
    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.githubConfig.clientId,
          client_secret: this.githubConfig.clientSecret,
          code,
          redirect_uri: this.githubConfig.redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`GitHub token exchange failed: ${tokenResponse.statusText}`);
      }

      const tokenData: GitHubTokenResponse = await tokenResponse.json();

      // Get user information
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!userResponse.ok) {
        throw new Error(`Failed to fetch GitHub user: ${userResponse.statusText}`);
      }

      const userData: GitHubUser = await userResponse.json();

      // Create session
      const session = this.createSession(
        userData.id.toString(),
        'github',
        tokenData.access_token,
        undefined,
        userData
      );

      logger.app.info(`GitHub OAuth successful for user: ${userData.login}`);
      return session;

    } catch (error) {
      logger.app.error('GitHub OAuth callback failed:', error);
      throw error;
    } finally {
      // Clean up state
      this.pendingStates.delete(state);
    }
  }

  /**
   * Handle Claude OAuth callback
   */
  async handleClaudeCallback(code: string, state: string): Promise<UserSession> {
    const stateData = this.validateState(state, 'claude');
    
    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://api.anthropic.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.claudeConfig.clientId,
          client_secret: this.claudeConfig.clientSecret || '',
          code,
          redirect_uri: this.claudeConfig.redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Claude token exchange failed: ${tokenResponse.statusText}`);
      }

      const tokenData: ClaudeTokenResponse = await tokenResponse.json();

      // Get user information
      const userResponse = await fetch('https://api.anthropic.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
        },
      });

      if (!userResponse.ok) {
        throw new Error(`Failed to fetch Claude user: ${userResponse.statusText}`);
      }

      const userData: ClaudeUser = await userResponse.json();

      // Create session
      const expiresAt = tokenData.expires_in 
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : undefined;

      const session = this.createSession(
        userData.id,
        'claude',
        tokenData.access_token,
        tokenData.refresh_token,
        userData,
        expiresAt
      );

      logger.app.info(`Claude OAuth successful for user: ${userData.email}`);
      return session;

    } catch (error) {
      logger.app.error('Claude OAuth callback failed:', error);
      throw error;
    } finally {
      // Clean up state
      this.pendingStates.delete(state);
    }
  }

  /**
   * Get session by session ID
   */
  getSession(sessionId: string): UserSession | undefined {
    const session = this.userSessions.get(sessionId);
    
    // Check if session is expired
    if (session && session.expiresAt && session.expiresAt < new Date()) {
      this.userSessions.delete(sessionId);
      return undefined;
    }
    
    return session;
  }

  /**
   * Refresh Claude access token
   */
  async refreshClaudeToken(sessionId: string): Promise<UserSession> {
    const session = this.getSession(sessionId);
    
    if (!session || session.provider !== 'claude' || !session.refreshToken) {
      throw new Error('Invalid session or no refresh token available');
    }

    try {
      const tokenResponse = await fetch('https://api.anthropic.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.claudeConfig.clientId,
          client_secret: this.claudeConfig.clientSecret || '',
          refresh_token: session.refreshToken,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token refresh failed: ${tokenResponse.statusText}`);
      }

      const tokenData: ClaudeTokenResponse = await tokenResponse.json();

      // Update session
      session.accessToken = tokenData.access_token;
      if (tokenData.refresh_token) {
        session.refreshToken = tokenData.refresh_token;
      }
      if (tokenData.expires_in) {
        session.expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
      }

      this.userSessions.set(sessionId, session);
      
      logger.app.info(`Token refreshed for session: ${sessionId}`);
      return session;

    } catch (error) {
      logger.app.error('Token refresh failed:', error);
      // Remove invalid session
      this.userSessions.delete(sessionId);
      throw error;
    }
  }

  /**
   * Revoke session and logout
   */
  async revokeSession(sessionId: string): Promise<void> {
    const session = this.getSession(sessionId);
    
    if (!session) {
      return; // Already invalid
    }

    try {
      if (session.provider === 'github') {
        // Revoke GitHub token
        await fetch(`https://api.github.com/applications/${this.githubConfig.clientId}/token`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.githubConfig.clientId}:${this.githubConfig.clientSecret}`).toString('base64')}`,
            'Accept': 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            access_token: session.accessToken,
          }),
        });
      } else if (session.provider === 'claude') {
        // Revoke Claude token
        await fetch('https://api.anthropic.com/oauth/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            token: session.accessToken,
            client_id: this.claudeConfig.clientId,
            client_secret: this.claudeConfig.clientSecret || '',
          }),
        });
      }
    } catch (error) {
      logger.app.warn(`Failed to revoke ${session.provider} token:`, error);
    } finally {
      // Remove session regardless of revocation success
      this.userSessions.delete(sessionId);
      logger.app.info(`Session revoked: ${sessionId}`);
    }
  }

  /**
   * Get GitHub access token for session
   */
  getGitHubToken(sessionId: string): string | undefined {
    const session = this.getSession(sessionId);
    return session?.provider === 'github' ? session.accessToken : undefined;
  }

  /**
   * Get Claude access token for session
   */
  getClaudeToken(sessionId: string): string | undefined {
    const session = this.getSession(sessionId);
    return session?.provider === 'claude' ? session.accessToken : undefined;
  }

  // Private methods

  private generateState(provider: 'github' | 'claude', returnUrl?: string): string {
    const state = randomBytes(32).toString('hex');
    
    this.pendingStates.set(state, {
      state,
      provider,
      timestamp: Date.now(),
      returnUrl
    });

    // Cleanup state after 10 minutes
    setTimeout(() => {
      this.pendingStates.delete(state);
    }, 10 * 60 * 1000);

    return state;
  }

  private validateState(state: string, expectedProvider: 'github' | 'claude'): OAuthState {
    const stateData = this.pendingStates.get(state);
    
    if (!stateData) {
      throw new Error('Invalid or expired OAuth state');
    }

    if (stateData.provider !== expectedProvider) {
      throw new Error('OAuth state provider mismatch');
    }

    // Check if state is too old (10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      this.pendingStates.delete(state);
      throw new Error('OAuth state expired');
    }

    return stateData;
  }

  private createSession(
    userId: string,
    provider: 'github' | 'claude',
    accessToken: string,
    refreshToken?: string,
    userInfo?: GitHubUser | ClaudeUser,
    expiresAt?: Date
  ): UserSession {
    const sessionId = randomBytes(32).toString('hex');
    
    const session: UserSession = {
      sessionId,
      userId,
      provider,
      accessToken,
      refreshToken,
      userInfo: userInfo!,
      createdAt: new Date(),
      expiresAt
    };

    this.userSessions.set(sessionId, session);
    
    return session;
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.userSessions.entries()) {
      if (session.expiresAt && session.expiresAt < now) {
        this.userSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.app.info(`Cleaned up ${cleanedCount} expired sessions`);
    }
  }
}

// Global OAuth service instance
export const oauthService = new OAuthService();