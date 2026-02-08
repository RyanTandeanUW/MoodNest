/**
 * Main entry point for the MoodNest application
 * This file bootstraps the React app and mounts it to the DOM
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Find the root element and render our app inside it
// StrictMode helps catch potential problems during development
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
