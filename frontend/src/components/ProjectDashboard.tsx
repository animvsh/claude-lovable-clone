import { useState, useEffect, useCallback } from "react";
import {
  FolderIcon,
  ClockIcon,
  CodeBracketIcon,
  EyeIcon,
  TrashIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import type { ProjectInfo } from "../types";

interface ProjectWithMetadata extends ProjectInfo {
  id: string;
  name: string; // Display name derived from path
  lastModified: Date;
  isStarred: boolean;
  language: string;
  description?: string;
  tags: string[];
  size: string;
}

export interface ProjectDashboardProps {
  projects: ProjectInfo[];
  onProjectSelect: (projectPath: string) => void;
  onProjectCreate: () => void;
  onProjectDelete?: (projectPath: string) => void;
  className?: string;
}

const MOCK_PROJECT_METADATA: Record<string, Partial<ProjectWithMetadata>> = {
  "react-todo": {
    description: "A modern todo application built with React and TypeScript",
    language: "TypeScript",
    tags: ["React", "TypeScript", "Tailwind", "Vite"],
    isStarred: true,
    size: "2.3 MB"
  },
  "api-server": {
    description: "REST API server with Express and PostgreSQL",
    language: "JavaScript",
    tags: ["Node.js", "Express", "PostgreSQL", "API"],
    isStarred: false,
    size: "1.8 MB"
  },
  "portfolio": {
    description: "Personal portfolio website with blog functionality",
    language: "TypeScript",
    tags: ["Next.js", "React", "Markdown", "Blog"],
    isStarred: true,
    size: "3.1 MB"
  }
};

export function ProjectDashboard({ 
  projects, 
  onProjectSelect, 
  onProjectCreate, 
  onProjectDelete,
  className = "" 
}: ProjectDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBy, setFilterBy] = useState<"all" | "starred" | "recent">("all");
  const [sortBy, setSortBy] = useState<"name" | "modified" | "size">("modified");
  const [projectsWithMetadata, setProjectsWithMetadata] = useState<ProjectWithMetadata[]>([]);

  // Convert projects to projects with metadata
  useEffect(() => {
    const enrichedProjects: ProjectWithMetadata[] = projects.map((project, index) => {
      // Derive display name from path
      const displayName = project.path.split('/').pop() || project.encodedName;
      const projectKey = displayName.toLowerCase().replace(/\s+/g, '-');
      const metadata = MOCK_PROJECT_METADATA[projectKey] || {};
      
      return {
        ...project,
        id: `project-${index}`,
        name: displayName,
        lastModified: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random last week
        isStarred: metadata.isStarred || false,
        language: metadata.language || "JavaScript",
        description: metadata.description,
        tags: metadata.tags || [],
        size: metadata.size || "1.2 MB"
      };
    });

    setProjectsWithMetadata(enrichedProjects);
  }, [projects]);

  // Filter and sort projects
  const filteredProjects = projectsWithMetadata
    .filter(project => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          project.name.toLowerCase().includes(query) ||
          project.description?.toLowerCase().includes(query) ||
          project.tags.some(tag => tag.toLowerCase().includes(query))
        );
      }
      return true;
    })
    .filter(project => {
      // Category filter
      switch (filterBy) {
        case "starred":
          return project.isStarred;
        case "recent":
          return project.lastModified > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // Last 3 days
        default:
          return true;
      }
    })
    .sort((a, b) => {
      // Sort
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "size":
          return parseFloat(a.size) - parseFloat(b.size);
        case "modified":
        default:
          return b.lastModified.getTime() - a.lastModified.getTime();
      }
    });

  const toggleStar = useCallback((projectId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setProjectsWithMetadata(prev => 
      prev.map(project => 
        project.id === projectId 
          ? { ...project, isStarred: !project.isStarred }
          : project
      )
    );
  }, []);

  const handleDelete = useCallback((projectPath: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm("Are you sure you want to delete this project?")) {
      onProjectDelete?.(projectPath);
    }
  }, [onProjectDelete]);

  const getLanguageColor = (language: string) => {
    const colors: Record<string, string> = {
      "TypeScript": "bg-blue-100 text-blue-800",
      "JavaScript": "bg-yellow-100 text-yellow-800",
      "Python": "bg-green-100 text-green-800",
      "Go": "bg-cyan-100 text-cyan-800",
      "Rust": "bg-orange-100 text-orange-800",
      "Java": "bg-red-100 text-red-800",
    };
    return colors[language] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`max-w-7xl mx-auto p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Projects</h1>
          <p className="text-gray-600">
            {filteredProjects.length} of {projectsWithMetadata.length} projects
          </p>
        </div>
        
        <button
          onClick={onProjectCreate}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg"
        >
          <PlusIcon className="h-5 w-5" />
          New Project
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        {/* Search */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          
          {["all", "starred", "recent"].map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterBy(filter as typeof filterBy)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
                filterBy === filter
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="modified">Sort by Modified</option>
          <option value="name">Sort by Name</option>
          <option value="size">Sort by Size</option>
        </select>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          {searchQuery || filterBy !== "all" ? (
            <div>
              <MagnifyingGlassIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
              <p className="text-gray-600 mb-4">
                Try adjusting your search or filters to find what you're looking for.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setFilterBy("all");
                }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div>
              <FolderIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first project to get started with Claude Dev Studio.
              </p>
              <button
                onClick={onProjectCreate}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all"
              >
                <PlusIcon className="h-5 w-5" />
                Create Project
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => onProjectSelect(project.path)}
              className="group bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all cursor-pointer overflow-hidden"
            >
              {/* Project header */}
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                      <FolderIcon className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                        {project.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getLanguageColor(project.language)}`}>
                          {project.language}
                        </span>
                        <span className="text-xs text-gray-500">{project.size}</span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => toggleStar(project.id, e)}
                    className="p-1 text-gray-400 hover:text-yellow-500 transition-colors"
                  >
                    {project.isStarred ? (
                      <StarIconSolid className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <StarIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {project.description || "No description available"}
                </p>

                {/* Tags */}
                {project.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {project.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {project.tags.length > 3 && (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">
                        +{project.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Last modified */}
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-4">
                  <ClockIcon className="h-4 w-4" />
                  Modified {formatDate(project.lastModified)}
                </div>
              </div>

              {/* Project actions */}
              <div className="flex items-center gap-1 px-6 py-3 bg-gray-50 border-t border-gray-100">
                <button
                  onClick={() => onProjectSelect(project.path)}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex-1 justify-center"
                >
                  <CodeBracketIcon className="h-4 w-4" />
                  Open
                </button>
                
                <button
                  onClick={() => onProjectSelect(project.path)}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors flex-1 justify-center"
                >
                  <EyeIcon className="h-4 w-4" />
                  Preview
                </button>

                {onProjectDelete && (
                  <button
                    onClick={(e) => handleDelete(project.path, e)}
                    className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}