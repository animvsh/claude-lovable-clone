import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FolderIcon, SparklesIcon, ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import type { ProjectsResponse, ProjectInfo } from "../types";
import { getProjectsUrl } from "../config/api";
import { SettingsButton } from "./SettingsButton";
import { SettingsModal } from "./SettingsModal";

export function ProjectSelector() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(getProjectsUrl());
      if (!response.ok) {
        throw new Error(`Failed to load projects: ${response.statusText}`);
      }
      const data: ProjectsResponse = await response.json();
      setProjects(data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (projectPath: string, useStudio = false) => {
    const normalizedPath = projectPath.startsWith("/")
      ? projectPath
      : `/${projectPath}`;
    
    if (useStudio) {
      navigate(`/studio${normalizedPath}`);
    } else {
      navigate(`/projects${normalizedPath}`);
    }
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600 dark:text-slate-400">
          Loading projects...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-slate-800 dark:text-slate-100 text-3xl font-bold tracking-tight">
            Select a Project
          </h1>
          <SettingsButton onClick={handleSettingsClick} />
        </div>

        <div className="space-y-3">
          {projects.length > 0 && (
            <>
              <h2 className="text-slate-700 dark:text-slate-300 text-lg font-medium mb-4">
                Recent Projects
              </h2>
              {projects.map((project) => (
                <div
                  key={project.path}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Project info header */}
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <FolderIcon className="h-5 w-5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                      <span className="text-slate-800 dark:text-slate-200 font-mono text-sm flex-1">
                        {project.path}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleProjectSelect(project.path, true)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-md hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-medium text-sm"
                      >
                        <SparklesIcon className="h-4 w-4" />
                        Open Dev Studio
                      </button>
                      
                      <button
                        onClick={() => handleProjectSelect(project.path, false)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors font-medium text-sm"
                      >
                        <ChatBubbleLeftIcon className="h-4 w-4" />
                        Chat Only
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Settings Modal */}
        <SettingsModal isOpen={isSettingsOpen} onClose={handleSettingsClose} />
      </div>
    </div>
  );
}
