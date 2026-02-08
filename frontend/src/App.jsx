import { useState, useEffect, useRef, useCallback } from "react";
import "./index.css";
import "./App.css";
import Hero from "./components/Hero";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import ApartmentModel from "./components/ApartmentModel";
import VoiceRecorder from "./components/VoiceRecorder";
import * as THREE from "three";

function App() {
  // --- UI & 3D States ---
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // --- Audio States & Syncing ---
  const [vibe, setVibe] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // 1. Sync with Backend (Music & Vibe Data)
  useEffect(() => {
    const fetchVibe = async () => {
      try {
        const res = await fetch("http://localhost:8000/state");
        const data = await res.json();
        // data.audio_url and data.color are used here
        setVibe(data);
      } catch (err) {
        console.error("FastAPI Backend Offline");
      }
    };

    fetchVibe();
    const interval = setInterval(fetchVibe, 2000);
    return () => clearInterval(interval);
  }, []);

  // 2. Audio Toggle Function (Unlocks audio context on first click)
  const toggleSound = useCallback(() => {
    if (!isAudioEnabled) {
      setIsAudioEnabled(true);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  }, [isAudioEnabled]);

  // 3. Audio Effect Sync
  useEffect(() => {
    if (audioRef.current && isAudioEnabled) {
      if (isPlaying) {
        audioRef.current.play().catch((e) => console.log("Interaction required to play"));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, vibe, isAudioEnabled]);

  // --- Existing UI Handlers ---
  const handleRecordingComplete = (result) => {
    console.log("Recording complete!", result);
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
    <div className="min-h-screen relative overflow-hidden bg-slate-900 transition-colors duration-1000">
      
      {/* --- Dynamic Background (Synced with Vibe Color) --- */}
      <div 
        className="absolute inset-0 transition-all duration-1000 opacity-40 blur-[120px]"
        style={{ background: `radial-gradient(circle at 50% 50%, ${vibe?.color || '#4f46e5'}, transparent)` }}
      />
      
      {/* Animated wave backgrounds */}
      <div className="absolute inset-0 wave opacity-40">
        <div className="absolute top-1/4 left-1/4 w-[800px] h-[800px] rounded-full blur-3xl transition-all duration-1000"
             style={{ backgroundColor: vibe?.color || "#4f46e5" }}></div>
      </div>

      {/* --- Hidden Audio Element --- */}
      {vibe?.audio_url && isAudioEnabled && (
        <audio
          ref={audioRef}
          src={vibe.audio_url}
          autoPlay
          loop
          onPlay={() => console.log("🔊 Music Playing")}
        />
      )}

      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-slate-900/30"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <div
          className={`w-full transition-all duration-700 ${isExpanded ? "max-w-none" : "max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"}`}
        >
          {/* Left Side - Hero & Music Control */}
          <div
            className={`transition-opacity duration-700 ${
              isExpanded || isTransitioning ? "opacity-0 pointer-events-none" : "opacity-100 flex flex-col gap-10"
            }`}
          >
            <Hero />
            
            {/* Music Toggle Button */}
            <div className="flex flex-col items-start gap-4">
              <button 
                autoFocus 
                onClick={toggleSound}
                className={`px-12 py-4 rounded-full font-bold text-lg shadow-2xl transition-all transform hover:scale-105 ${
                  isPlaying ? "bg-red-500 text-white" : "bg-white text-slate-900 animate-pulse"
                }`}
              >
                {!isAudioEnabled ? "SYNC VIBE AUDIO (ENTER)" : isPlaying ? "PAUSE MUSIC" : "RESUME MUSIC"}
              </button>
              {isAudioEnabled && (
                <p className="text-white/40 font-mono text-xs uppercase tracking-[0.3em] ml-4">
                  Atmosphere: {vibe?.label}
                </p>
              )}
            </div>
          </div>

          {/* Right Side - 3D Apartment Preview */}
          <div
            className={`${isExpanded ? "fixed inset-0 z-50 flex items-center justify-center p-8" : "relative"}`}
          >
            <div
              className={`bg-slate-800/30 backdrop-blur-sm rounded-2xl border flex items-center justify-center ${
                isExpanded
                  ? "w-full h-full"
                  : "aspect-[4/3] cursor-pointer hover:shadow-[0_0_40px_rgba(168,85,247,0.4)]"
              } ${isTransitioning ? "opacity-0" : "opacity-100"}`}
              style={{
                borderColor: vibe ? `${vibe.color}66` : "rgba(168,85,247,0.3)",
                transition: "opacity 0.5s, width 0.7s, height 0.7s, border-color 0.3s, box-shadow 0.3s",
              }}
              onClick={() => !isExpanded && handleExpand()}
            >
              {isExpanded && (
                <>
                  {/* Close Button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCollapse(); }}
                    className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/60 hover:bg-slate-700/80 border border-white/20 text-white z-50 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {/* Voice Recorder - Bottom Center */}
                  <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50">
                    <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
                  </div>
                </>
              )}
              
              <div className={`absolute bottom-4 right-4 flex items-center gap-2 text-purple-300/60 text-sm pointer-events-none transition-opacity duration-500 ${!isExpanded && !isTransitioning ? "opacity-100" : "opacity-0"}`}>
                <span>Click to explore home</span>
              </div>

              <Canvas
                camera={{ position: [2.8, 1.5, 3.4], fov: 50 }}
                shadows
                gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
              >
                <ambientLight intensity={0.8} />
                <directionalLight position={[5, 5, 5]} intensity={1.5} castShadow />
                <directionalLight position={[-5, 2, -3]} intensity={0.6} />
                <ApartmentModel />
                <OrbitControls
                  enablePan={isExpanded}
                  enableZoom={isExpanded}
                  enableDamping={true}
                  minDistance={2}
                  maxDistance={8}
                />
              </Canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;