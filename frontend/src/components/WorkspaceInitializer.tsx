import { useState, useEffect } from 'react';
import { useGitHub } from '../contexts/GitHubContext';
import { cloneAndInitializeRepository, initializeClaudeEnvironment } from '../utils/workspaceApi';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  ArrowPathIcon,
  RocketLaunchIcon,
  FolderIcon,
  CodeBracketIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';

interface WorkspaceInitializerProps {
  repositoryName: string;
  repositoryUrl: string;
  onComplete: (workspacePath: string, sessionId: string) => void;
  onError: (error: string) => void;
}

interface InitializationStep {
  id: string;
  label: string;
  activeLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export function WorkspaceInitializer({ 
  repositoryName, 
  repositoryUrl, 
  onComplete, 
  onError 
}: WorkspaceInitializerProps) {
  const { accessToken } = useGitHub();
  const [steps, setSteps] = useState<InitializationStep[]>([
    {
      id: 'clone',
      label: 'Clone repository',
      activeLabel: 'Cloning repository...',
      icon: FolderIcon,
      status: 'pending'
    },
    {
      id: 'setup',
      label: 'Setup workspace',
      activeLabel: 'Setting up workspace...',
      icon: CodeBracketIcon,
      status: 'pending'
    },
    {
      id: 'claude',
      label: 'Initialize Claude',
      activeLabel: 'Initializing Claude environment...',
      icon: CommandLineIcon,
      status: 'pending'
    },
    {
      id: 'sync',
      label: 'Enable auto-sync',
      activeLabel: 'Enabling real-time sync...',
      icon: RocketLaunchIcon,
      status: 'pending'
    }
  ]);

  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeWorkspace();
  }, []);

  const updateStepStatus = (stepIndex: number, status: InitializationStep['status']) => {
    setSteps(prev => prev.map((step, index) => 
      index === stepIndex ? { ...step, status } : step
    ));
  };

  const initializeWorkspace = async () => {
    if (!accessToken) {
      onError('Not authenticated with GitHub');
      return;
    }

    try {
      // Step 1: Clone repository and setup workspace
      setCurrentStep(0);
      updateStepStatus(0, 'active');
      
      const cloneResponse = await cloneAndInitializeRepository({
        repositoryUrl: repositoryUrl.replace('github.com', 'github.com') + '.git',
        repositoryName,
        branch: 'main', // Will fallback to master or other default branch
        accessToken
      });

      if (!cloneResponse.success) {
        throw new Error(cloneResponse.error || 'Failed to clone repository');
      }
      
      updateStepStatus(0, 'completed');
      
      // Step 2: Setup workspace (this is already done in the clone step)
      setCurrentStep(1);
      updateStepStatus(1, 'active');
      
      // Add a small delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateStepStatus(1, 'completed');
      
      // Step 3: Initialize Claude environment
      setCurrentStep(2);
      updateStepStatus(2, 'active');
      
      const claudeResponse = await initializeClaudeEnvironment(cloneResponse.workspace.id);

      if (!claudeResponse.success) {
        throw new Error(claudeResponse.error || 'Failed to initialize Claude environment');
      }
      
      updateStepStatus(2, 'completed');
      
      // Step 4: Initialize sync
      setCurrentStep(3);
      updateStepStatus(3, 'active');
      
      const syncResponse = await fetch('/api/sync/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: cloneResponse.workspace.id,
          repositoryUrl: repositoryUrl,
          accessToken,
          branch: 'main', // Will be determined by the backend
          autoCommit: true,
          autoSync: true,
          syncInterval: 30,
          collaborationMode: false
        })
      });

      if (!syncResponse.ok) {
        // Non-fatal error - continue without sync
        console.warn('Failed to initialize sync, continuing without auto-sync');
      }
      
      updateStepStatus(3, 'completed');
      
      // Complete
      setTimeout(() => {
        onComplete(cloneResponse.workspace.localPath, claudeResponse.claudeSessionId);
      }, 500);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Initialization failed';
      setError(errorMessage);
      updateStepStatus(currentStep, 'error');
      onError(errorMessage);
    }
  };

  const getStepIcon = (step: InitializationStep) => {
    if (step.status === 'completed') {
      return CheckCircleIcon;
    } else if (step.status === 'error') {
      return ExclamationTriangleIcon;
    } else if (step.status === 'active') {
      return ArrowPathIcon;
    }
    return step.icon;
  };

  const getStepColor = (step: InitializationStep) => {
    switch (step.status) {
      case 'completed':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'active':
        return 'text-blue-400';
      default:
        return 'text-white/40';
    }
  };

  const getStepBgColor = (step: InitializationStep) => {
    switch (step.status) {
      case 'completed':
        return 'bg-green-500/20 border-green-500/30';
      case 'error':
        return 'bg-red-500/20 border-red-500/30';
      case 'active':
        return 'bg-blue-500/20 border-blue-500/30';
      default:
        return 'bg-white/10 border-white/20';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl">
              <RocketLaunchIcon className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">
            Setting up Development Environment
          </h1>
          <div className="bg-white/10 backdrop-blur-xl rounded-xl p-4 border border-white/20">
            <h2 className="text-xl text-white font-semibold">{repositoryName}</h2>
            <p className="text-white/70 text-sm mt-1">{repositoryUrl}</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="space-y-4 mb-8">
          {steps.map((step, index) => {
            const Icon = getStepIcon(step);
            const isActive = step.status === 'active';
            
            return (
              <div
                key={step.id}
                className={`relative flex items-center p-6 rounded-2xl border transition-all duration-500 ${getStepBgColor(step)}`}
              >
                <div className={`flex items-center justify-center w-12 h-12 rounded-xl mr-4 transition-colors ${
                  step.status === 'active' ? 'bg-blue-500' : 
                  step.status === 'completed' ? 'bg-green-500' :
                  step.status === 'error' ? 'bg-red-500' : 'bg-white/20'
                }`}>
                  <Icon className={`h-6 w-6 ${
                    step.status === 'active' ? 'animate-spin' : ''
                  } ${
                    step.status === 'active' || step.status === 'completed' || step.status === 'error' 
                      ? 'text-white' 
                      : 'text-white/60'
                  }`} />
                </div>
                
                <div className="flex-1">
                  <h3 className={`font-semibold ${getStepColor(step)}`}>
                    {isActive ? step.activeLabel : step.label}
                  </h3>
                  
                  {step.status === 'active' && (
                    <div className="mt-2 w-full bg-white/20 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                  )}
                  
                  {step.status === 'error' && error && (
                    <p className="text-red-300 text-sm mt-2">{error}</p>
                  )}
                </div>
                
                {/* Step number */}
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                  step.status === 'completed' ? 'bg-green-500 text-white' :
                  step.status === 'error' ? 'bg-red-500 text-white' :
                  step.status === 'active' ? 'bg-blue-500 text-white' :
                  'bg-white/20 text-white/60'
                }`}>
                  {step.status === 'completed' ? '✓' : 
                   step.status === 'error' ? '✗' : 
                   index + 1}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer message */}
        <div className="text-center">
          <p className="text-white/60 text-sm">
            This may take a few moments while we prepare your development environment...
          </p>
        </div>
      </div>
    </div>
  );
}