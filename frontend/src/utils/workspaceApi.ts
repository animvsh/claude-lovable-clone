export interface Workspace {
  id: string;
  repositoryName: string;
  repositoryUrl: string;
  localPath: string;
  branch: string;
  status: 'cloning' | 'ready' | 'active' | 'error';
  createdAt: string;
  claudeSessionId?: string;
}

export interface CloneAndInitializeRequest {
  repositoryUrl: string;
  repositoryName: string;
  branch?: string;
  accessToken: string;
}

export interface CloneAndInitializeResponse {
  success: boolean;
  workspace: {
    id: string;
    repositoryName: string;
    localPath: string;
    branch: string;
    status: string;
  };
  error?: string;
  details?: string;
}

export interface InitializeClaudeResponse {
  success: boolean;
  claudeSessionId: string;
  workspacePath: string;
  error?: string;
}

/**
 * Clone a repository and initialize workspace
 */
export async function cloneAndInitializeRepository(request: CloneAndInitializeRequest): Promise<CloneAndInitializeResponse> {
  const response = await fetch('/api/workspaces/clone-and-initialize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to clone and initialize repository');
  }

  return response.json();
}

/**
 * Get all active workspaces
 */
export async function getWorkspaces(): Promise<{ workspaces: Workspace[] }> {
  const response = await fetch('/api/workspaces');

  if (!response.ok) {
    throw new Error('Failed to get workspaces');
  }

  return response.json();
}

/**
 * Initialize Claude environment for workspace
 */
export async function initializeClaudeEnvironment(workspaceId: string): Promise<InitializeClaudeResponse> {
  const response = await fetch(`/api/workspaces/${workspaceId}/initialize-claude`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to initialize Claude environment');
  }

  return response.json();
}

/**
 * Get workspace status
 */
export async function getWorkspaceStatus(workspaceId: string): Promise<Workspace & { directoryExists: boolean }> {
  const response = await fetch(`/api/workspaces/${workspaceId}/status`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get workspace status');
  }

  return response.json();
}

/**
 * Delete workspace
 */
export async function deleteWorkspace(workspaceId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`/api/workspaces/${workspaceId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete workspace');
  }

  return response.json();
}