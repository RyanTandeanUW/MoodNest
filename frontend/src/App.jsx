import { useState, useEffect } from "react";
import ReactPlayer from "react-player";
import "./index.css";
import "./App.css";
import Hero from "./components/Hero";

function App() {
  const [vibe, setVibe] = useState(null);

  // Function to sync with your FastAPI backend
  const fetchCurrentVibe = async () => {
    try {
      const response = await fetch("http://localhost:8000/state");
      const data = await response.json();
      setVibe(data);
    } catch (error) {
      console.error("Backend unreachable. Ensure FastAPI is running.");
    }
  };

  useEffect(() => {
    fetchCurrentVibe(); // Initial fetch
    const interval = setInterval(fetchCurrentVibe, 2000); // Check for updates every 2s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-900 transition-colors duration-1000">
      {/* Dynamic Background Waves */}
      <div className="absolute inset-0 wave opacity-40">
        <div 
          className="absolute top-1/4 left-1/4 w-[800px] h-[800px] rounded-full blur-3xl transition-all duration-1000"
          style={{ backgroundColor: vibe?.color || "#4f46e5" }}
        ></div>
      </div>
      
      {/* Hidden Music Player */}
      {vibe?.youtube_id && (
        <div style={{ display: 'none' }}>
          <ReactPlayer
            url={`https://www.youtube.com/watch?v=${vibe.youtube_id}`}
            playing={true}
            loop={true}
            volume={0.5}
            config={{
              youtube: {
                playerVars: { autoplay: 1 }
              }
            }}
          />
        </div>
      )}

      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-slate-900/30"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <Hero />

          {/* Right Side - Reactive 3D Preview */}
          <div 
            className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border aspect-square flex flex-col items-center justify-center transition-all duration-700"
            style={{ borderColor: vibe ? `${vibe.color}66` : "rgba(168, 85, 247, 0.3)" }}
          >
            <p className="text-purple-300 text-lg mb-4">3D Home Preview</p>
            {vibe && (
              <div className="text-center animate-pulse">
                <p className="text-white font-bold text-xl uppercase tracking-tighter">
                  {vibe.label} Mode
                </p>
                <p className="text-xs text-purple-200 mt-2 opacity-60">Music ID: {vibe.youtube_id}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;