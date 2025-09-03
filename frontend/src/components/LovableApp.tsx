import { useState, useEffect, useCallback } from "react";
import { LovableLayout } from "./LovableLayout";
import type { ProjectInfo } from "../types";
import { getProjectsUrl } from "../config/api";

export function LovableApp() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(getProjectsUrl());
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }
      
      const projectsData = await response.json();
      setProjects(projectsData);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
      setError(err instanceof Error ? err.message : "Failed to load projects");
      
      // Set some mock projects for development
      setProjects([
        {
          path: "/Users/prathu/projects/react-todo",
          encodedName: "react-todo",
        },
        {
          path: "/Users/prathu/projects/api-server",
          encodedName: "api-server",
        },
        {
          path: "/Users/prathu/projects/portfolio",
          encodedName: "portfolio",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading Claude Dev Studio...</p>
        </div>
      </div>
    );
  }

  if (error && projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="h-16 w-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Failed to Load Projects
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md">
            {error}
          </p>
          <button
            onClick={fetchProjects}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <LovableLayout
      projects={projects}
      onProjectsRefresh={fetchProjects}
    />
  );
}