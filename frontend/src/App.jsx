import { useState } from "react";
import "./App.css";
import Hero from "./components/Hero";

function App() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <Hero />

        {/* Right Side - 3D Apartment Preview */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-purple-500/20 aspect-square flex items-center justify-center">
          <p className="text-purple-300 text-lg">3D Home Preview</p>
        </div>
      </div>
    </div>
  );
}

export default App;
