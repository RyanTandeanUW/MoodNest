import { useState, useRef } from "react";
import ResultPopup from "./ResultPopup";
import RecordButton from "./RecordButton";

/**
 * VoiceRecorder - Main voice recording and mood detection component
 *
 * This component handles the entire voice recording workflow:
 * 1. Captures audio from the user's microphone when button is held
 * 2. Sends the recording to the backend for mood analysis
 * 3. Displays the result (stays visible until next recording)
 * 4. Notifies parent component when a mood is successfully detected AND confirmed
 *
 * Two modes available:
 * - Quick Mode: Direct emotion detection from voice
 * - Conversation Mode: Gemini asks follow-up questions, then requests permission
 *   before changing room lighting. User must confirm with "yes" to apply changes.
 *
 * Recording is done with a "hold-to-record" pattern - press and hold
 * the button to record, release to stop and send for analysis.
 */
export default function VoiceRecorder({ onRecordingComplete }) {
  // Track the current recording state
  const [isRecording, setIsRecording] = useState(false);

  // Track if we're waiting for backend response
  const [isProcessing, setIsProcessing] = useState(false);

  // Store the last result from the backend
  const [lastResult, setLastResult] = useState(null);

  // Control whether the result popup is visible
  const [showResult, setShowResult] = useState(false);

  // Mode: 'quick' for instant detection, 'conversation' for follow-up questions
  const [mode, setMode] = useState("quick");

  // Reference to the MediaRecorder instance
  const mediaRecorderRef = useRef(null);

  // Store audio data chunks as they're recorded
  const audioChunksRef = useRef([]);

  // Reference to the currently playing audio (for stopping AI voice when recording)
  const currentAudioRef = useRef(null);

  /**
   * Stop any currently playing AI audio
   * Called when user starts a new recording
   */
  const stopCurrentAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      console.log("🔇 Stopped AI audio");
    }
  };

  /**
   * Play audio received from backend (ElevenLabs TTS as base64)
   * Plays through browser - no temp files, no windows
   */
  const playAudioFromBase64 = (audioBase64) => {
    try {
      // Stop any currently playing audio first
      stopCurrentAudio();

      // Convert base64 to blob
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create and play audio element
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      audio.play().catch((error) => {
        console.error("Error playing audio:", error);
      });

      // Clean up URL when audio finishes
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      };

      console.log("🔊 Playing AI audio through browser");
    } catch (error) {
      console.error("Error playing audio from base64:", error);
    }
  };

  /**
   * Start recording audio from the user's microphone
   * Requests microphone permission if not already granted
   */
  const startRecording = async () => {
    // Stop any AI audio that's currently playing
    stopCurrentAudio();
    try {
      // Request access to the microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Collect audio data as it's recorded
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // When recording stops, process the audio
      mediaRecorder.onstop = async () => {
        // Combine all chunks into a single audio blob
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });
        await sendAudioToBackend(audioBlob);

        // Release the microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  /**
   * Stop the current recording
   * This triggers the onstop handler which sends audio to backend
   */
  /**
   * Stop the current recording
   * This triggers the onstop handler which sends audio to backend
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  /**
   * Send recorded audio to the backend for mood analysis
   * Uses different endpoints based on current mode
   */
  const sendAudioToBackend = async (audioBlob) => {
    setIsProcessing(true);
    setShowResult(false);

    try {
      // Prepare the audio file for upload
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");

      // Choose endpoint based on mode
      const endpoint =
        mode === "conversation"
          ? "http://localhost:8000/analyze-voice-conversation"
          : "http://localhost:8000/analyze-voice";

      console.log(`📡 Using ${mode} mode endpoint:`, endpoint);

      // Send to backend mood detection endpoint
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Backend response:", result);

        // In conversation mode, play the audio response from ElevenLabs
        if (mode === "conversation" && result.audio) {
          console.log("💬 AI said:", result.ai_response);
          playAudioFromBase64(result.audio);
        }

        // Display the result to the user
        setLastResult(result);
        setShowResult(true);

        // If mood was successfully detected AND confirmed, notify parent component
        // This triggers the apartment lighting AND music to change
        // Don't change if we're still waiting for user confirmation
        if (
          result.success &&
          !result.awaiting_confirmation &&
          onRecordingComplete
        ) {
          console.log(
            "✅ Mood confirmed, updating lights and music:",
            result.detected_mood,
          );
          onRecordingComplete(result);
        } else if (result.awaiting_confirmation) {
          console.log("⏳ Waiting for user confirmation before changing mood");
        }
      } else {
        // Server error response
        console.error("Failed to send audio:", response.statusText);
        setLastResult({
          success: false,
          error: "Failed to connect to backend",
        });
        setShowResult(true);
      }
    } catch (error) {
      // Network or other error
      console.error("Error sending audio to backend:", error);
      setLastResult({ success: false, error: error.message });
      setShowResult(true);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Show result popup when available */}
      <ResultPopup result={lastResult} show={showResult} />

      <div className="flex flex-col items-center gap-4">
        {/* Mode toggle - switches between quick and conversation modes */}
        <div className="flex items-center gap-2 bg-slate-800/40 backdrop-blur-sm rounded-full p-1 border border-purple-500/30">
          <button
            onClick={() => setMode("quick")}
            disabled={isRecording || isProcessing}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              mode === "quick"
                ? "bg-purple-600 text-white shadow-lg"
                : "text-purple-300 hover:text-white"
            } ${isRecording || isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            ⚡ Quick
          </button>
          <button
            onClick={() => setMode("conversation")}
            disabled={isRecording || isProcessing}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              mode === "conversation"
                ? "bg-purple-600 text-white shadow-lg"
                : "text-purple-300 hover:text-white"
            } ${isRecording || isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            💬 Talk
          </button>
        </div>

        {/* Main recording button - supports both mouse and touch */}
        <RecordButton
          isRecording={isRecording}
          isProcessing={isProcessing}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
        />

        {/* Status text below button */}
        <p className="text-sm text-purple-300 text-center">
          {isRecording
            ? "🎙️ Recording... Release to send"
            : isProcessing
              ? "⏳ Processing..."
              : mode === "conversation"
                ? "Hold to talk - Gemini will respond"
                : "Hold to record - Quick mood detection"}
        </p>

        {/* Mode description */}
        <p className="text-xs text-purple-400/60 text-center max-w-xs">
          {mode === "conversation"
            ? "AI will chat with you, then ask permission before changing your room lighting"
            : "Instant emotion detection from your voice"}
        </p>
      </div>
    </>
  );
}
