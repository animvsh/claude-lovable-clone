import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy } from "react";
import { ProjectSelector } from "./components/ProjectSelector";
import { ChatPage } from "./components/ChatPage";
import { DevStudioLayout } from "./components/DevStudioLayout";
import { LovableApp } from "./components/LovableApp";
import { SettingsProvider } from "./contexts/SettingsContext";
import { SupabaseProvider } from "./contexts/SupabaseContext";
import { isDevelopment } from "./utils/environment";
import { normalizeWindowsPath } from "./utils/pathUtils";

// Lazy load DemoPage only in development
const DemoPage = isDevelopment()
  ? lazy(() =>
      import("./components/DemoPage").then((module) => ({
        default: module.DemoPage,
      })),
    )
  : null;

// Dev Studio Layout Wrapper
function DevStudioLayoutWrapper() {
  const location = useLocation();
  
  // Extract and normalize working directory from URL
  const workingDirectory = (() => {
    const rawPath = location.pathname.replace("/studio", "");
    if (!rawPath) return "/";
    
    // URL decode the path
    const decodedPath = decodeURIComponent(rawPath);
    
    // Normalize Windows paths
    return normalizeWindowsPath(decodedPath);
  })();

  // Generate session ID from working directory
  const sessionId = btoa(workingDirectory).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);

  return (
    <DevStudioLayout 
      workingDirectory={workingDirectory}
      sessionId={sessionId}
    />
  );
}

function App() {
  return (
    <SettingsProvider>
      <SupabaseProvider>
        <Router>
          <Routes>
            {/* New Lovable-inspired interface */}
            <Route path="/" element={<LovableApp />} />
            <Route path="/projects" element={<LovableApp />} />
            <Route path="/projects/*" element={<LovableApp />} />
            
            {/* Legacy routes for backward compatibility */}
            <Route path="/legacy" element={<ProjectSelector />} />
            <Route path="/studio/*" element={<DevStudioLayoutWrapper />} />
            <Route path="/chat/*" element={<ChatPage />} />
            
            {DemoPage && (
              <Route
                path="/demo"
                element={
                  <Suspense fallback={<div>Loading demo...</div>}>
                    <DemoPage />
                  </Suspense>
                }
              />
            )}
          </Routes>
        </Router>
      </SupabaseProvider>
    </SettingsProvider>
  );
}

export default App;
