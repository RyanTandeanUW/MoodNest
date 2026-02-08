import { useState, useEffect, useRef } from "react"; // Added useEffect and useRef
import "./index.css";
import "./App.css";
import Hero from "./components/Hero";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import ApartmentModel from "./components/ApartmentModel";
import VoiceRecorder from "./components/VoiceRecorder";
import * as THREE from "three";

function App() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentMood, setCurrentMood] = useState("neutral");
  
  // NEW: State for audio control
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(new Audio());

  /**
   * Sync Music with Mood
   * Fetches the latest track from the backend whenever currentMood changes.
   */
  useEffect(() => {
    const syncMusic = async () => {
      try {
        const res = await fetch("http://localhost:8000/state");
        const data = await res.json();
        
        // Ensure we have a track URL from your Google Drive presets
        if (data?.vibe_details?.track) {
          const trackUrl = data.vibe_details.track;

          if (audioRef.current.src !== trackUrl) {
            audioRef.current.src = trackUrl;
            audioRef.current.loop = true;
          }

          // Handle Play/Pause based on mute state
          if (isMuted) {
            audioRef.current.pause();
          } else {
            // Play only after user has interacted with the page
            audioRef.current.play().catch(() => console.log("Audio waiting for user click..."));
          }
        }
      } catch (e) {
        console.error("Music sync failed:", e);
      }
    };
    syncMusic();
  }, [currentMood, isMuted]);

  const handleRecordingComplete = (result) => {
    if (result.success && result.detected_mood) {
      setCurrentMood(result.detected_mood);
    }
  };

  const handleExpand = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setIsExpanded(true);
      setTimeout(() => setIsTransitioning(false), 200);
    }, 500);
  };

  const handleCollapse = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setIsExpanded(false);
      setTimeout(() => setIsTransitioning(false), 200);
    }, 500);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-900">
      {/* Background waves remain the same... */}
      <div className="absolute inset-0 bg-slate-900/30"></div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <div className={`w-full transition-all duration-700 ${isExpanded ? "max-w-none" : "max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"}`}>
          
          <div className={`transition-opacity duration-700 ${isExpanded || isTransitioning ? "opacity-0" : "opacity-100"}`}>
            {!isExpanded && <Hero />}
          </div>

          <div className={`${isExpanded ? "fixed inset-0 z-50 flex items-center justify-center p-8" : "relative"}`}>
            <div
              className={`bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 flex items-center justify-center ${
                isExpanded ? "w-full h-full" : "aspect-[4/3] cursor-pointer hover:shadow-[0_0_40px_rgba(168,85,247,0.4)]"
              } ${isTransitioning ? "opacity-0" : "opacity-100"}`}
              onClick={() => !isExpanded && handleExpand()}
              style={{ transition: "all 0.7s ease-in-out" }}
            >
              {isExpanded && (
                <>
                  {/* NEW: Sound Toggle Button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                    className="absolute top-4 right-16 w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/60 border border-purple-500/30 text-white z-50 hover:bg-purple-500/30"
                  >
                    {isMuted ? "🔇" : "🔊"}
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleCollapse(); }}
                    className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/60 border border-purple-500/30 text-white z-50"
                  >
                    ✕
                  </button>

                  <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50">
                    <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
                  </div>
                </>
              )}

              {/* Three.js Canvas remains the same... */}
              <Canvas camera={{ position: [2.8, 1.5, 3.4], fov: 50 }} shadows>
                <ambientLight intensity={0.8} />
                <directionalLight position={[5, 5, 5]} intensity={1.5} castShadow />
                <ApartmentModel mood={currentMood} />
                <OrbitControls enableDamping dampingFactor={0.05} />
              </Canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;