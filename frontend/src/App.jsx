import { useState } from "react";
import "./index.css";
import "./App.css";
import Hero from "./components/Hero";

function App() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-900">
      {/* Animated wave backgrounds */}
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

      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-slate-900/30"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <Hero />

          {/* Right Side - 3D Apartment Preview */}
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 aspect-square flex items-center justify-center">
            <p className="text-purple-300 text-lg">3D Home Preview</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
