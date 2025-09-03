import type { Context } from "hono";
import { oauthService } from "../services/oauthService.js";
import { logger } from "../utils/logger.js";

/**
 * Initiate GitHub OAuth flow
 */
export async function initiateGitHubAuth(c: Context) {
  try {
    const returnUrl = c.req.query('returnUrl');
    const authUrl = oauthService.generateGitHubAuthUrl(returnUrl);
    
    logger.app.info('GitHub OAuth flow initiated');
    
    return c.json({
      success: true,
      authUrl,
      message: 'Redirect user to this URL to complete GitHub authentication'
    });
  } catch (error) {
    logger.app.error('Failed to initiate GitHub OAuth:', error);
    return c.json({
      error: 'Failed to initiate GitHub authentication',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * Handle GitHub OAuth callback
 */
export async function handleGitHubCallback(c: Context) {
  try {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    if (error) {
      logger.app.warn(`GitHub OAuth error: ${error}`);
      return c.redirect(`/auth/error?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return c.json({ error: 'Missing code or state parameter' }, 400);
    }

    const session = await oauthService.handleGitHubCallback(code, state);
    
    // Set session cookie
    c.header('Set-Cookie', `session=${session.sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`); // 30 days
    
    // Redirect to success page or return URL
    const returnUrl = c.req.query('returnUrl') || '/auth/success?provider=github';
    return c.redirect(returnUrl);
    
  } catch (error) {
    logger.app.error('GitHub OAuth callback failed:', error);
    return c.redirect(`/auth/error?error=${encodeURIComponent('Authentication failed')}`);
  }
}

/**
 * Initiate Claude OAuth flow
 */
export async function initiateClaudeAuth(c: Context) {
  try {
    const returnUrl = c.req.query('returnUrl');
    const authUrl = oauthService.generateClaudeAuthUrl(returnUrl);
    
    logger.app.info('Claude OAuth flow initiated');
    
    return c.json({
      success: true,
      authUrl,
      message: 'Redirect user to this URL to complete Claude authentication'
    });
  } catch (error) {
    logger.app.error('Failed to initiate Claude OAuth:', error);
    return c.json({
      error: 'Failed to initiate Claude authentication',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * Handle Claude OAuth callback
 */
export async function handleClaudeCallback(c: Context) {
  try {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    if (error) {
      logger.app.warn(`Claude OAuth error: ${error}`);
      return c.redirect(`/auth/error?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return c.json({ error: 'Missing code or state parameter' }, 400);
    }

    const session = await oauthService.handleClaudeCallback(code, state);
    
    // Set session cookie
    c.header('Set-Cookie', `claude_session=${session.sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${24 * 60 * 60}`); // 24 hours
    
    // Redirect to success page or return URL
    const returnUrl = c.req.query('returnUrl') || '/auth/success?provider=claude';
    return c.redirect(returnUrl);
    
  } catch (error) {
    logger.app.error('Claude OAuth callback failed:', error);
    return c.redirect(`/auth/error?error=${encodeURIComponent('Authentication failed')}`);
  }
}

/**
 * Get current authentication status
 */
export async function getAuthStatus(c: Context) {
  try {
    // Get session from cookie or header
    const sessionCookie = c.req.header('Cookie')?.split(';')
      .find(cookie => cookie.trim().startsWith('session='))
      ?.split('=')[1];
    
    const claudeSessionCookie = c.req.header('Cookie')?.split(';')
      .find(cookie => cookie.trim().startsWith('claude_session='))
      ?.split('=')[1];

    const githubSession = sessionCookie ? oauthService.getSession(sessionCookie) : undefined;
    const claudeSession = claudeSessionCookie ? oauthService.getSession(claudeSessionCookie) : undefined;

    return c.json({
      success: true,
      github: githubSession ? {
        authenticated: true,
        user: githubSession.userInfo,
        sessionId: githubSession.sessionId
      } : {
        authenticated: false
      },
      claude: claudeSession ? {
        authenticated: true,
        user: claudeSession.userInfo,
        sessionId: claudeSession.sessionId
      } : {
        authenticated: false
      }
    });
  } catch (error) {
    logger.app.error('Failed to get auth status:', error);
    return c.json({
      error: 'Failed to get authentication status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * Logout from GitHub
 */
export async function logoutGitHub(c: Context) {
  try {
    const sessionCookie = c.req.header('Cookie')?.split(';')
      .find(cookie => cookie.trim().startsWith('session='))
      ?.split('=')[1];

    if (sessionCookie) {
      await oauthService.revokeSession(sessionCookie);
    }

    // Clear session cookie
    c.header('Set-Cookie', 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    
    return c.json({
      success: true,
      message: 'Logged out from GitHub'
    });
  } catch (error) {
    logger.app.error('GitHub logout failed:', error);
    return c.json({
      error: 'Failed to logout from GitHub',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * Logout from Claude
 */
export async function logoutClaude(c: Context) {
  try {
    const sessionCookie = c.req.header('Cookie')?.split(';')
      .find(cookie => cookie.trim().startsWith('claude_session='))
      ?.split('=')[1];

    if (sessionCookie) {
      await oauthService.revokeSession(sessionCookie);
    }

    // Clear session cookie
    c.header('Set-Cookie', 'claude_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    
    return c.json({
      success: true,
      message: 'Logged out from Claude'
    });
  } catch (error) {
    logger.app.error('Claude logout failed:', error);
    return c.json({
      error: 'Failed to logout from Claude',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * Get GitHub repositories using OAuth token
 */
export async function getGitHubRepositories(c: Context) {
  try {
    const sessionCookie = c.req.header('Cookie')?.split(';')
      .find(cookie => cookie.trim().startsWith('session='))
      ?.split('=')[1];

    if (!sessionCookie) {
      return c.json({ error: 'Not authenticated with GitHub' }, 401);
    }

    const session = oauthService.getSession(sessionCookie);
    if (!session || session.provider !== 'github') {
      return c.json({ error: 'Invalid GitHub session' }, 401);
    }

    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch repositories: ${response.statusText}`);
    }

    const repositories = await response.json();
    
    return c.json({
      success: true,
      repositories
    });
  } catch (error) {
    logger.app.error('Failed to fetch GitHub repositories:', error);
    return c.json({
      error: 'Failed to fetch repositories',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * Execute Claude Code command using OAuth token
 */
export async function executeClaudeCommand(c: Context) {
  try {
    const sessionCookie = c.req.header('Cookie')?.split(';')
      .find(cookie => cookie.trim().startsWith('claude_session='))
      ?.split('=')[1];

    if (!sessionCookie) {
      return c.json({ error: 'Not authenticated with Claude' }, 401);
    }

    const session = oauthService.getSession(sessionCookie);
    if (!session || session.provider !== 'claude') {
      return c.json({ error: 'Invalid Claude session' }, 401);
    }

    const { command, workingDirectory } = await c.req.json();
    
    if (!command) {
      return c.json({ error: 'Missing command parameter' }, 400);
    }

    // Execute Claude Code command via API
    const response = await fetch('https://api.anthropic.com/v1/claude-code/execute', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command,
        working_directory: workingDirectory
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    return c.json({
      success: true,
      result
    });
  } catch (error) {
    logger.app.error('Failed to execute Claude command:', error);
    return c.json({
      error: 'Failed to execute Claude command',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * Middleware to extract session from cookies
 */
export function createAuthMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    // Extract sessions from cookies
    const cookies = c.req.header('Cookie') || '';
    
    const githubSessionId = cookies.split(';')
      .find(cookie => cookie.trim().startsWith('session='))
      ?.split('=')[1];
    
    const claudeSessionId = cookies.split(';')
      .find(cookie => cookie.trim().startsWith('claude_session='))
      ?.split('=')[1];

    // Add sessions to context
    if (githubSessionId) {
      const githubSession = oauthService.getSession(githubSessionId);
      if (githubSession && githubSession.provider === 'github') {
        c.set('githubSession', githubSession);
        c.set('githubToken', githubSession.accessToken);
      }
    }

    if (claudeSessionId) {
      const claudeSession = oauthService.getSession(claudeSessionId);
      if (claudeSession && claudeSession.provider === 'claude') {
        c.set('claudeSession', claudeSession);
        c.set('claudeToken', claudeSession.accessToken);
      }
    }

    await next();
  };
}