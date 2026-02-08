import { useState, useRef } from "react";

/**
 * VoiceRecorder
 *
 * A hold-to-record voice input component that captures audio
 * and sends it to the backend for processing.
 */
export default function VoiceRecorder({ onRecordingComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });
        await sendAudioToBackend(audioBlob);

        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudioToBackend = async (audioBlob) => {
    setIsProcessing(true);
    setShowResult(false);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");

      const response = await fetch("http://localhost:8000/analyze-voice", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Backend response:", result);

        // Show the result
        setLastResult(result);
        setShowResult(true);

        // Hide result after 5 seconds
        setTimeout(() => {
          setShowResult(false);
        }, 5000);

        if (onRecordingComplete) {
          onRecordingComplete(result);
        }
      } else {
        console.error("Failed to send audio:", response.statusText);
        setLastResult({ success: false, error: "Failed to connect to backend" });
        setShowResult(true);
        setTimeout(() => setShowResult(false), 5000);
      }
    } catch (error) {
      console.error("Error sending audio to backend:", error);
      setLastResult({ success: false, error: error.message });
      setShowResult(true);
      setTimeout(() => setShowResult(false), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isProcessing}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 ${
          isRecording
            ? "bg-red-500 scale-110 shadow-[0_0_30px_rgba(239,68,68,0.6)]"
            : "bg-purple-600 hover:bg-purple-500"
        } ${
          isProcessing ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
        } shadow-lg`}
      >
        {isProcessing ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-8 h-8 text-white"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
            />
          </svg>
        )}

        {/* Recording pulse animation */}
        {isRecording && (
          <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
        )}
      </button>

      <p className="text-sm text-purple-300">
        {isRecording
          ? "🎙️ Recording... Release to send"
          : isProcessing
            ? "⏳ Processing..."
            : "Hold to record"}
      </p>

      {/* Result Display */}
      {showResult && lastResult && (
        <div
          className={`mt-4 p-4 rounded-lg border ${
            lastResult.success
              ? "bg-green-500/10 border-green-500/30 text-green-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          } animate-fadeInUp max-w-xs text-center`}
        >
          {lastResult.success ? (
            <>
              <div className="text-2xl mb-2">
                {lastResult.detected_mood === "focus" && "🎯"}
                {lastResult.detected_mood === "chill" && "😌"}
                {lastResult.detected_mood === "chaos" && "⚡"}
                {lastResult.detected_mood === "forest" && "🌲"}
                {lastResult.detected_mood === "midnight" && "🌙"}
              </div>
              <div className="font-semibold text-lg capitalize">
                {lastResult.detected_mood}
              </div>
              {lastResult.confidence && (
                <div className="text-sm opacity-80 mt-1">
                  {Math.round(lastResult.confidence * 100)}% confidence
                </div>
              )}
              {lastResult.message && (
                <div className="text-xs mt-2 opacity-70">
                  {lastResult.message}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-2xl mb-2">❌</div>
              <div className="font-semibold">Error</div>
              <div className="text-xs mt-2 opacity-80">
                {lastResult.error || "Failed to process audio"}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
