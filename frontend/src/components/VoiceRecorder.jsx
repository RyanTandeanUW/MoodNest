import { useState, useRef } from "react";
import ResultPopup from "./ResultPopup";
import RecordButton from "./RecordButton";

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
        console.log("Success field:", result.success);
        console.log("Should show yellow?", !result.success);

        // Show the result
        setLastResult(result);
        setShowResult(true);

        // Hide result after 5 seconds
        setTimeout(() => {
          setShowResult(false);
        }, 5000);

        // Only pass successful mood detections to parent
        if (result.success && onRecordingComplete) {
          onRecordingComplete(result);
        }
      } else {
        console.error("Failed to send audio:", response.statusText);
        setLastResult({
          success: false,
          error: "Failed to connect to backend",
        });
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
    <>
      <ResultPopup result={lastResult} show={showResult} />

      <div className="flex flex-col items-center gap-4">
        <RecordButton
          isRecording={isRecording}
          isProcessing={isProcessing}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
        />

        <p className="text-sm text-purple-300">
          {isRecording
            ? "🎙️ Recording... Release to send"
            : isProcessing
              ? "⏳ Processing..."
              : "Hold to record"}
        </p>
      </div>
    </>
  );
}
