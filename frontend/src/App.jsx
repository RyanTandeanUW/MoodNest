/**
 * MoodNest - Main Application Component
 *
 * This is the heart of MoodNest. It handles:
 * - Displaying the hero section and 3D apartment preview
 * - Expanding the apartment view to fullscreen
 * - Managing the current mood state (happy, sad, angry, neutral)
 * - Passing mood changes to the 3D apartment for lighting updates
 */
import { useState } from "react";
import "./index.css";
import "./App.css";
import Hero from "./components/Hero";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import ApartmentModel from "./components/ApartmentModel";
import VoiceRecorder from "./components/VoiceRecorder";
import * as THREE from "three";

function App() {
  // Track whether the apartment view is expanded to fullscreen
  const [isExpanded, setIsExpanded] = useState(false);

  // Track if we're currently animating between states
  const [isTransitioning, setIsTransitioning] = useState(false);

  // The current detected mood - this drives the apartment's lighting
  const [currentMood, setCurrentMood] = useState("neutral");

  /**
   * Called when voice recording successfully detects a mood
   * Updates the apartment's lighting to match the detected emotion
   */
  const handleRecordingComplete = (result) => {
    console.log("Recording complete!", result);
    if (result.success && result.detected_mood) {
      setCurrentMood(result.detected_mood);
      console.log("🎨 Mood changed to:", result.detected_mood);
    }
  };

  /**
   * Expands the apartment view to fill the entire screen
   * Uses a short animation to make the transition smooth
   */
  const handleExpand = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setIsExpanded(true);
      setTimeout(() => setIsTransitioning(false), 200);
    }, 500);
  };

  /**
   * Collapses the apartment view back to the side-by-side layout
   * Returns to showing the hero section alongside the preview
   */
  const handleCollapse = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setIsExpanded(false);
      setTimeout(() => setIsTransitioning(false), 200);
    }, 500);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-900">
      {/* 
        Animated Background Layers
        Multiple animated gradients create a dynamic, flowing background effect
        Each "wave" moves at a different speed for depth
      */}
      <div className="absolute inset-0 wave opacity-40">
        <div className="absolute top-1/4 left-1/4 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 blur-3xl"></div>
      </div>
      <div className="absolute inset-0 wave-slow opacity-30">
        <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-purple-700 via-pink-600 to-indigo-700 blur-3xl"></div>
      </div>
      <div className="absolute inset-0 wave-slower opacity-35">
        <div className="absolute bottom-1/4 left-1/3 w-[700px] h-[700px] rounded-full bg-gradient-to-tr from-pink-600 via-purple-700 to-indigo-600 blur-3xl"></div>
      </div>
      <div className="absolute inset-0 wave opacity-25">
        <div className="absolute bottom-1/3 right-1/3 w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-indigo-500 to-purple-600 blur-3xl"></div>
      </div>
      <div className="absolute inset-0 wave-slow opacity-30">
        <div className="absolute top-1/2 left-1/2 w-[650px] h-[650px] rounded-full bg-gradient-to-r from-pink-500 to-indigo-500 blur-3xl"></div>
      </div>
      <div className="absolute inset-0 wave-slower opacity-28">
        <div className="absolute top-2/3 right-1/2 w-[550px] h-[550px] rounded-full bg-gradient-to-tl from-purple-500 to-pink-500 blur-3xl"></div>
      </div>
      <div className="absolute inset-0 wave opacity-32">
        <div className="absolute top-1/4 right-1/3 w-[480px] h-[480px] rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 blur-3xl"></div>
      </div>

      {/* Semi-transparent overlay to prevent background from overwhelming content */}
      <div className="absolute inset-0 bg-slate-900/30"></div>

      {/* Main Content Container */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <div
          className={`w-full transition-all duration-700 ${isExpanded ? "max-w-none" : "max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"}`}
        >
          {/* Left Side - Hero/Landing Content (hidden when expanded) */}
          <div
            className={`transition-opacity duration-700 ${
              isExpanded || isTransitioning ? "opacity-0" : "opacity-100"
            }`}
          >
            {!isExpanded && <Hero />}
          </div>

          {/* Right Side - Interactive 3D Apartment Preview */}
          <div
            className={`${isExpanded ? "fixed inset-0 z-50 flex items-center justify-center p-8" : "relative"}`}
          >
            <div
              className={`bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 flex items-center justify-center ${
                isExpanded
                  ? "w-full h-full"
                  : "aspect-[4/3] cursor-pointer hover:border-purple-300/80 hover:shadow-[0_0_40px_rgba(168,85,247,0.4)]"
              } ${isTransitioning ? "opacity-0" : "opacity-100"}`}
              style={{
                transition:
                  "opacity 0.5s ease-in-out, width 0.7s ease-out, height 0.7s ease-out, border-color 0.3s ease-out, box-shadow 0.3s ease-out",
              }}
              onClick={() => !isExpanded && handleExpand()}
            >
              {isExpanded && (
                <>
                  {/* Close Button - Returns to side-by-side view */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCollapse();
                    }}
                    className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/60 hover:bg-slate-700/80 border border-purple-500/30 hover:border-purple-400/50 text-white/80 hover:text-white hover:shadow-[0_0_20px_rgba(168,85,247,0.6)] hover:scale-110 transition-all duration-200 z-50"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>

                  {/* Voice Recorder - Only visible in fullscreen mode */}
                  <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50">
                    <VoiceRecorder
                      onRecordingComplete={handleRecordingComplete}
                    />
                  </div>
                </>
              )}

              {/* Hint to click for fullscreen - only shown in preview mode */}
              <div
                className={`absolute bottom-4 right-4 flex items-center gap-2 text-purple-300/60 text-sm pointer-events-none transition-opacity duration-500 ${!isExpanded && !isTransitioning ? "opacity-100" : "opacity-0"}`}
              >
                <span>Click to expand</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                  />
                </svg>
              </div>

              {/* 
                Three.js Canvas - Renders the 3D apartment
                Configured for optimal performance and visual quality
              */}
              <Canvas
                camera={{ position: [2.8, 1.5, 3.4], fov: 50 }}
                dpr={[1, 2]} // Device pixel ratio for crisp rendering
                shadows="soft" // Enable soft shadows
                gl={{
                  antialias: true, // Smooth edges
                  powerPreference: "high-performance",
                  toneMapping: THREE.ACESFilmicToneMapping, // Cinematic color grading
                  toneMappingExposure: 1.0,
                }}
                onCreated={({ gl }) => {
                  // Configure shadow quality
                  gl.shadowMap.enabled = true;
                  gl.shadowMap.type = THREE.PCFSoftShadowMap;
                }}
                performance={{ min: 0.5 }} // Maintain at least 30fps
              >
                {/* Lighting Setup */}

                {/* Ambient light provides base illumination throughout the scene */}
                <ambientLight intensity={0.8} />

                {/* Main directional light - simulates sunlight with shadows */}
                <directionalLight
                  position={[5, 5, 5]}
                  intensity={1.5}
                  castShadow
                  shadow-mapSize-width={2048}
                  shadow-mapSize-height={2048}
                  shadow-bias={-0.0005}
                  shadow-normalBias={0.05}
                  shadow-camera-near={0.5}
                  shadow-camera-far={20}
                  shadow-camera-left={-8}
                  shadow-camera-right={8}
                  shadow-camera-top={8}
                  shadow-camera-bottom={-8}
                />

                {/* Fill light - softens shadows and adds depth */}
                <directionalLight position={[-5, 2, -3]} intensity={0.6} />

                {/* The apartment 3D model - receives mood changes */}
                <ApartmentModel mood={currentMood} />

                {/* Camera controls - allows user to rotate, pan, and zoom */}
                <OrbitControls
                  enablePan={true}
                  enableZoom={true}
                  enableRotate={true}
                  enableDamping={true} // Smooth, inertial movement
                  dampingFactor={0.05}
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
