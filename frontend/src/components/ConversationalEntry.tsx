import { useState, useCallback, useRef, useEffect } from "react";
import {
  PlusIcon,
  SparklesIcon,
  CommandLineIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  CircleStackIcon,
  LightBulbIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

interface ProjectTemplate {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tags: string[];
  gradient: string;
}

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "react-app",
    title: "React Application",
    description: "Modern React app with TypeScript, Vite, and Tailwind CSS",
    icon: CodeBracketIcon,
    tags: ["React", "TypeScript", "Vite", "Tailwind"],
    gradient: "from-blue-500 to-purple-600"
  },
  {
    id: "api-server",
    title: "API Server",
    description: "REST API with Node.js, Express, and database integration",
    icon: CommandLineIcon,
    tags: ["Node.js", "Express", "API", "Database"],
    gradient: "from-green-500 to-teal-600"
  },
  {
    id: "full-stack",
    title: "Full-Stack App",
    description: "Complete web application with frontend and backend",
    icon: GlobeAltIcon,
    tags: ["Full-Stack", "React", "Node.js", "Database"],
    gradient: "from-orange-500 to-pink-600"
  },
  {
    id: "database-app",
    title: "Database Application",
    description: "Data-driven app with Supabase integration",
    icon: CircleStackIcon,
    tags: ["Supabase", "Database", "Auth", "Real-time"],
    gradient: "from-purple-500 to-indigo-600"
  },
  {
    id: "ai-app",
    title: "AI-Powered App",
    description: "Intelligent application with Claude AI integration",
    icon: SparklesIcon,
    tags: ["AI", "Claude", "Machine Learning", "Chat"],
    gradient: "from-pink-500 to-rose-600"
  },
  {
    id: "startup-mvp",
    title: "Startup MVP",
    description: "Minimum viable product for your startup idea",
    icon: RocketLaunchIcon,
    tags: ["MVP", "Startup", "Landing Page", "Analytics"],
    gradient: "from-cyan-500 to-blue-600"
  }
];

export interface ConversationalEntryProps {
  onProjectCreate: (prompt: string, template?: string) => void;
  className?: string;
}

export function ConversationalEntry({ onProjectCreate, className = "" }: ConversationalEntryProps) {
  const [prompt, setPrompt] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(200, Math.max(60, textarea.scrollHeight)) + 'px';
    }
  }, [prompt]);

  // Focus textarea when expanded
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  const handlePromptSubmit = useCallback(async () => {
    if (!prompt.trim() && !selectedTemplate) return;
    
    setIsLoading(true);
    
    try {
      // Create project with prompt and template
      await onProjectCreate(prompt.trim() || "Create a new project", selectedTemplate || undefined);
      
      // Reset form
      setPrompt("");
      setSelectedTemplate(null);
      setIsExpanded(false);
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsLoading(false);
    }
  }, [prompt, selectedTemplate, onProjectCreate]);

  const handleTemplateSelect = useCallback((templateId: string) => {
    setSelectedTemplate(prev => prev === templateId ? null : templateId);
    if (!isExpanded) {
      setIsExpanded(true);
    }
  }, [isExpanded]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handlePromptSubmit();
    }
  }, [handlePromptSubmit]);

  const selectedTemplateData = selectedTemplate ? 
    PROJECT_TEMPLATES.find(t => t.id === selectedTemplate) : null;

  return (
    <div className={`max-w-4xl mx-auto p-8 ${className}`}>
      {/* Main heading */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
            <SparklesIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Claude Dev Studio
          </h1>
        </div>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Describe what you want to build, and I'll help you create it with AI-powered development tools
        </p>
      </div>

      {/* Quick start templates */}
      {!isExpanded && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 text-center">
            Quick Start Templates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROJECT_TEMPLATES.map((template) => {
              const Icon = template.icon;
              const isSelected = selectedTemplate === template.id;
              
              return (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className={`group p-6 rounded-xl border-2 transition-all text-left hover:shadow-lg ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg bg-gradient-to-r ${template.gradient} flex-shrink-0`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600">
                        {template.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {template.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {template.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-md"
                          >
                            {tag}
                          </span>
                        ))}
                        {template.tags.length > 3 && (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-500 rounded-md">
                            +{template.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                      <p className="text-sm text-blue-700 font-medium">
                        Template selected! Add your custom requirements below.
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Conversational input */}
      <div className="relative">
        {!isExpanded ? (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <PlusIcon className="h-5 w-5 text-gray-400 group-hover:text-blue-500" />
              <span className="text-gray-500 group-hover:text-gray-700">
                {selectedTemplate 
                  ? `Customize your ${selectedTemplateData?.title}...`
                  : "Describe your project idea or select a template above..."
                }
              </span>
            </div>
          </button>
        ) : (
          <div className="bg-white border-2 border-gray-200 rounded-xl shadow-lg p-6">
            {/* Selected template indicator */}
            {selectedTemplateData && (
              <div className="flex items-center gap-3 mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                <div className={`p-2 rounded-lg bg-gradient-to-r ${selectedTemplateData.gradient}`}>
                  <selectedTemplateData.icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{selectedTemplateData.title}</h3>
                  <p className="text-sm text-gray-600">{selectedTemplateData.description}</p>
                </div>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  ×
                </button>
              </div>
            )}

            {/* Input area */}
            <div className="space-y-4">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedTemplate 
                  ? "Describe any specific features, styling, or requirements for your project..."
                  : "Describe what you want to build. Be as detailed as you'd like - I can help with frontend, backend, databases, AI features, and more..."
                }
                className="w-full p-4 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                rows={3}
              />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>Press ⌘+Enter to create</span>
                  {selectedTemplate && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-medium">
                      Using {selectedTemplateData?.title} template
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setIsExpanded(false);
                      setPrompt("");
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePromptSubmit}
                    disabled={isLoading || (!prompt.trim() && !selectedTemplate)}
                    className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="h-4 w-4" />
                        Create Project
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Example prompts */}
      {!isExpanded && !selectedTemplate && (
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 mb-4">Need inspiration? Try these examples:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "Build a task management app with real-time collaboration",
              "Create an e-commerce store with payment processing",
              "Design a social media dashboard with analytics",
              "Make a portfolio website with a blog"
            ].map((example) => (
              <button
                key={example}
                onClick={() => {
                  setPrompt(example);
                  setIsExpanded(true);
                }}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                "{example}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Browse existing projects */}
      <div className="mt-8 text-center">
        <button
          onClick={() => navigate("/projects")}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
        >
          <LightBulbIcon className="h-4 w-4" />
          Browse existing projects
        </button>
      </div>
    </div>
  );
}