import { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  HomeIcon,
  FolderIcon,
  SparklesIcon,
  UserCircleIcon,
  CogIcon,
  QuestionMarkCircleIcon,
  MoonIcon,
  SunIcon,
  CodeBracketSquareIcon,
} from "@heroicons/react/24/outline";
import { ConversationalEntry } from "./ConversationalEntry";
import { ProjectDashboard } from "./ProjectDashboard";
import { DevStudioLayout } from "./DevStudioLayout";
import { GitHubAuth } from "./GitHubAuth";
import { GitHubRepoManager } from "./GitHubRepoManager";
import type { ProjectInfo } from "../types";

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
}

export interface LovableLayoutProps {
  projects: ProjectInfo[];
  onProjectsRefresh: () => void;
}

type ViewMode = "home" | "dashboard" | "project" | "github";

export function LovableLayout({ projects, onProjectsRefresh }: LovableLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Determine current view from URL
  useEffect(() => {
    const path = location.pathname;
    
    if (path === "/" || path === "/home") {
      setViewMode("home");
      setCurrentProject(null);
    } else if (path === "/github") {
      setViewMode("github");
      setCurrentProject(null);
    } else if (path === "/projects" || path.startsWith("/projects?")) {
      setViewMode("dashboard");
      setCurrentProject(null);
    } else if (path.startsWith("/projects/")) {
      setViewMode("project");
      const projectPath = decodeURIComponent(path.replace("/projects", ""));
      setCurrentProject(projectPath);
      
      // Get session ID from URL params
      const searchParams = new URLSearchParams(location.search);
      const urlSessionId = searchParams.get("sessionId");
      if (urlSessionId) {
        setSessionId(urlSessionId);
      }
    }
  }, [location]);

  const handleProjectCreate = useCallback(async (prompt: string, template?: string) => {
    console.log("Creating project with prompt:", prompt, "template:", template);
    
    // For now, navigate to dashboard - in a real app we'd create the project
    // Then redirect to the new project
    setViewMode("dashboard");
    navigate("/projects");
    
    // Refresh projects list
    onProjectsRefresh();
  }, [navigate, onProjectsRefresh]);

  const handleProjectSelect = useCallback((projectPath: string) => {
    setCurrentProject(projectPath);
    setViewMode("project");
    
    // Generate a new session ID for the project
    const newSessionId = btoa(projectPath).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
    setSessionId(newSessionId);
    
    // Navigate to project URL
    const encodedPath = encodeURIComponent(projectPath);
    navigate(`/projects${encodedPath}?sessionId=${newSessionId}`);
  }, [navigate]);

  const handleGoHome = useCallback(() => {
    setViewMode("home");
    setCurrentProject(null);
    setSessionId(null);
    navigate("/");
  }, [navigate]);

  const handleGoToDashboard = useCallback(() => {
    setViewMode("dashboard");
    setCurrentProject(null);
    setSessionId(null);
    navigate("/projects");
  }, [navigate]);

  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => {
      const newMode = !prev;
      document.documentElement.classList.toggle('dark', newMode);
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      return newMode;
    });
  }, []);

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    setIsDarkMode(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, []);

  const handleGoToGitHub = useCallback(() => {
    setViewMode("github");
    setCurrentProject(null);
    setSessionId(null);
    navigate("/github");
  }, [navigate]);

  const navigationItems: NavigationItem[] = [
    {
      id: "home",
      label: "Home",
      icon: HomeIcon,
      onClick: handleGoHome,
    },
    {
      id: "projects",
      label: "Projects",
      icon: FolderIcon,
      onClick: handleGoToDashboard,
    },
    {
      id: "create",
      label: "Create",
      icon: SparklesIcon,
      onClick: () => {
        if (viewMode !== "home") {
          handleGoHome();
        }
      },
    },
    {
      id: "github",
      label: "GitHub",
      icon: CodeBracketSquareIcon,
      onClick: handleGoToGitHub,
    },
  ];

  const bottomNavigationItems: NavigationItem[] = [
    {
      id: "theme",
      label: isDarkMode ? "Light Mode" : "Dark Mode",
      icon: isDarkMode ? SunIcon : MoonIcon,
      onClick: toggleTheme,
    },
    {
      id: "help",
      label: "Help",
      icon: QuestionMarkCircleIcon,
      onClick: () => window.open("https://docs.anthropic.com/claude/docs", "_blank"),
    },
    {
      id: "settings",
      label: "Settings",
      icon: CogIcon,
      onClick: () => {
        // TODO: Implement settings modal
        console.log("Settings clicked");
      },
    },
    {
      id: "profile",
      label: "Profile",
      icon: UserCircleIcon,
      onClick: () => {
        // TODO: Implement profile management
        console.log("Profile clicked");
      },
    },
  ];

  // If in project view, use the DevStudioLayout
  if (viewMode === "project" && currentProject && sessionId) {
    return (
      <DevStudioLayout 
        workingDirectory={currentProject}
        sessionId={sessionId}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-gray-700">
          {!sidebarCollapsed && (
            <>
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <SparklesIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Claude Dev</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Studio</p>
              </div>
            </>
          )}
          
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="ml-auto p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarCollapsed ? "M4 6h16M4 12h16M4 18h16" : "M6 18L18 6M6 6l12 12"} />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = (
              (item.id === "home" && viewMode === "home") ||
              (item.id === "projects" && viewMode === "dashboard") ||
              (item.id === "create" && viewMode === "home") ||
              (item.id === "github" && viewMode === "github")
            );

            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom navigation */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          {bottomNavigationItems.map((item) => {
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-sm">{item.label}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {viewMode === "home" && (
          <div className="h-full flex items-center justify-center">
            <ConversationalEntry onProjectCreate={handleProjectCreate} />
          </div>
        )}

        {viewMode === "dashboard" && (
          <div className="h-full overflow-auto">
            <ProjectDashboard
              projects={projects}
              onProjectSelect={handleProjectSelect}
              onProjectCreate={handleGoHome}
            />
          </div>
        )}

        {viewMode === "github" && (
          <div className="h-full overflow-auto">
            <GitHubRepoManager projects={projects} />
          </div>
        )}
      </div>

    </div>
  );
}