import { useState, useRef, useCallback, useEffect } from "react";
import {
  PaperAirplaneIcon,
  MicrophoneIcon,
  PaperClipIcon,
  CommandLineIcon,
  WrenchScrewdriverIcon,
  CircleStackIcon,
  CodeBracketIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

export interface EnhancedChatInterfaceProps {
  onSendMessage: (message: string, context?: ChatContext) => void;
  onFileUpload?: (files: FileList) => void;
  onVoiceInput?: (transcript: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

interface ChatContext {
  type: "code" | "database" | "file" | "error" | "suggestion";
  data?: any;
}

interface SmartSuggestion {
  text: string;
  type: "command" | "query" | "fix" | "explanation";
  icon: React.ComponentType<{ className?: string }>;
}

export function EnhancedChatInterface({
  onSendMessage,
  onFileUpload,
  onVoiceInput,
  disabled = false,
  placeholder = "Ask Claude anything about your code...",
}: EnhancedChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Smart suggestions based on context
  const smartSuggestions: SmartSuggestion[] = [
    {
      text: "Fix all linting errors in this project",
      type: "fix",
      icon: WrenchScrewdriverIcon,
    },
    {
      text: "Explain this code structure",
      type: "explanation", 
      icon: LightBulbIcon,
    },
    {
      text: "Create a new React component",
      type: "command",
      icon: CodeBracketIcon,
    },
    {
      text: "Query the users table",
      type: "query",
      icon: CircleStackIcon,
    },
    {
      text: "Help me debug this error",
      type: "fix",
      icon: ExclamationTriangleIcon,
    },
    {
      text: "Generate TypeScript types from my database",
      type: "command",
      icon: CommandLineIcon,
    },
  ];

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, []);

  // Handle message input
  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    adjustTextareaHeight();
    
    // Show suggestions when user starts typing
    if (e.target.value.length > 0 && !showSuggestions) {
      setShowSuggestions(true);
    }
  }, [adjustTextareaHeight, showSuggestions]);

  // Handle send message
  const handleSend = useCallback(() => {
    if (!message.trim() || disabled) return;

    // Determine context based on message content
    let context: ChatContext | undefined;
    
    if (message.toLowerCase().includes("sql") || message.toLowerCase().includes("database")) {
      context = { type: "database" };
    } else if (message.toLowerCase().includes("fix") || message.toLowerCase().includes("error")) {
      context = { type: "error" };
    } else if (selectedFiles.length > 0) {
      context = { type: "file", data: selectedFiles };
    }

    onSendMessage(message, context);
    setMessage("");
    setSelectedFiles([]);
    setShowSuggestions(false);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [message, disabled, selectedFiles, onSendMessage]);

  // Handle key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        // Allow new line with Shift+Enter
        return;
      } else {
        e.preventDefault();
        handleSend();
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }, [handleSend]);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files);
      setSelectedFiles(prev => [...prev, ...fileArray]);
      
      if (onFileUpload) {
        onFileUpload(files);
      }
    }
  }, [onFileUpload]);

  // Handle voice recording
  const toggleVoiceRecording = useCallback(async () => {
    if (isVoiceRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsVoiceRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];

        mediaRecorder.ondataavailable = (event) => {
          chunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          // const audioBlob = new Blob(chunks, { type: "audio/wav" });
          // Here you would typically send to a speech-to-text service
          // For now, we'll simulate with a placeholder
          if (onVoiceInput) {
            onVoiceInput("Voice input detected");
          }
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsVoiceRecording(true);
      } catch (error) {
        console.error("Failed to start voice recording:", error);
      }
    }
  }, [isVoiceRecording, onVoiceInput]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: SmartSuggestion) => {
    setMessage(suggestion.text);
    setShowSuggestions(false);
    
    // Auto-send common commands
    if (suggestion.type === "command" || suggestion.type === "fix") {
      setTimeout(() => {
        onSendMessage(suggestion.text, { type: suggestion.type === "fix" ? "error" : "code" });
        setMessage("");
      }, 100);
    }
  }, [onSendMessage]);

  // Remove selected file
  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Auto-adjust height on mount
  useEffect(() => {
    adjustTextareaHeight();
  }, [adjustTextareaHeight]);

  return (
    <div className="relative">
      {/* Smart suggestions */}
      {showSuggestions && message.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
          <div className="p-2">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 px-2 py-1">
              Smart Suggestions
            </div>
            {smartSuggestions
              .filter(suggestion => 
                suggestion.text.toLowerCase().includes(message.toLowerCase()) ||
                message.toLowerCase().includes(suggestion.type)
              )
              .slice(0, 4)
              .map((suggestion, index) => {
                const Icon = suggestion.icon;
                return (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                  >
                    <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {suggestion.text}
                    </span>
                    <span className="ml-auto text-xs text-slate-500 dark:text-slate-400 capitalize">
                      {suggestion.type}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Selected files */}
      {selectedFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-sm"
            >
              <PaperClipIcon className="h-3 w-3" />
              <span className="max-w-32 truncate">{file.name}</span>
              <button
                onClick={() => removeFile(index)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main input area */}
      <div className="flex items-end gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          title="Attach files"
        >
          <PaperClipIcon className="h-5 w-5" />
        </button>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full px-4 py-2 text-sm bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 border-0 resize-none focus:ring-0 focus:outline-none disabled:opacity-50"
            style={{ minHeight: "40px", maxHeight: "120px" }}
            rows={1}
          />
        </div>

        {/* Voice input button */}
        <button
          onClick={toggleVoiceRecording}
          className={`p-2 rounded-md transition-colors ${
            isVoiceRecording
              ? "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
          title={isVoiceRecording ? "Stop recording" : "Voice input"}
        >
          <MicrophoneIcon className={`h-5 w-5 ${isVoiceRecording ? 'animate-pulse' : ''}`} />
        </button>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Send message (Enter)"
        >
          <PaperAirplaneIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".js,.ts,.jsx,.tsx,.css,.html,.json,.md,.txt,.py,.java,.cpp,.c,.go,.rs,.php"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Usage hints */}
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          <span>Enter to send • Shift+Enter for new line</span>
        </div>
        <div className="flex items-center gap-2">
          <span>AI-powered code assistance</span>
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}