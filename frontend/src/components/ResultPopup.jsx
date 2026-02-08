import { createPortal } from "react-dom";

/**
 * ResultPopup - Mood detection result notification
 *
 * Displays the outcome of voice analysis at the top center of the screen.
 * Uses React Portal to render at document.body level, ensuring it appears
 * above all other UI elements regardless of parent positioning.
 *
 * Shows:
 * - Success: Detected mood with emoji and confidence level (green)
 * - Awaiting confirmation: Shows pending mood change waiting for user approval (blue)
 * - Conversation mode: Shows AI's response text along with detected mood
 * - Failure: Error message when mood cannot be detected (yellow)
 */
export default function ResultPopup({ result, show, onClose }) {
  // Don't render anything if not visible or no result
  if (!show || !result) return null;

  // Check if this is a conversation mode result
  const isConversationMode = result.mode === "conversation";
  const awaitingConfirmation = result.awaiting_confirmation;
  const pendingMood = result.pending_mood;

  return createPortal(
    <div
      className={`fixed top-8 left-1/2 -translate-x-1/2 z-[9999] p-4 rounded-lg border ${
        result.success
          ? awaitingConfirmation
            ? "bg-blue-500/10 border-blue-500/30 text-blue-300" // Blue when awaiting confirmation
            : "bg-green-500/10 border-green-500/30 text-green-300" // Green for successful detection
          : "bg-yellow-500/10 border-yellow-500/30 text-yellow-300" // Yellow for warnings/errors
      } animate-fadeInUp ${isConversationMode ? "max-w-md" : "max-w-xs"} text-center shadow-2xl backdrop-blur-sm`}
    >
      {result.success ? (
        // Successful mood detection
        <>
          {/* Show AI response in conversation mode */}
          {isConversationMode && result.ai_response && (
            <div
              className={`mb-3 pb-3 border-b ${awaitingConfirmation ? "border-blue-500/30" : "border-green-500/30"}`}
            >
              <div
                className={`text-xs mb-1 ${awaitingConfirmation ? "text-blue-400/60" : "text-green-400/60"}`}
              >
                AI Response:
              </div>
              <div className="text-sm italic">"{result.ai_response}"</div>
            </div>
          )}

          {/* Show pending mood if awaiting confirmation */}
          {awaitingConfirmation && pendingMood ? (
            <>
              <div className="text-2xl mb-2">🤔</div>
              <div className="font-semibold text-lg">
                Awaiting Your Response
              </div>
              <div className="text-sm mt-2 opacity-90">
                Will change to:{" "}
                <span className="capitalize font-semibold">{pendingMood}</span>
              </div>
              <div className="text-xs text-blue-400/60 mt-2">
                Say "yes" to confirm or "no" to cancel
              </div>
            </>
          ) : (
            <>
              {/* Emoji matching the detected mood */}
              <div className="text-2xl mb-2">
                {result.detected_mood === "happy" && "😊"}
                {result.detected_mood === "sad" && "😢"}
                {result.detected_mood === "angry" && "😠"}
                {result.detected_mood === "neutral" && "😐"}
              </div>

              {/* Mood label */}
              <div className="font-semibold text-lg capitalize">
                {result.detected_mood}
              </div>

              {/* Confidence percentage (if available in quick mode) */}
              {result.confidence && !isConversationMode && (
                <div className="text-sm opacity-80 mt-1">
                  {Math.round(result.confidence * 100)}% confidence
                </div>
              )}

              {/* Mode indicator */}
              {isConversationMode && (
                <div className="text-xs text-green-400/60 mt-2">
                  🔊 Audio played via ElevenLabs
                </div>
              )}
            </>
          )}
        </>
      ) : (
        // Error or failed detection
        <>
          <div className="text-2xl mb-2">⚠️</div>
          <div className="font-semibold">Unable to Detect Mood</div>
          <div className="text-xs mt-2 opacity-80">
            {result.error || "Recording not suitable for mood detection"}
          </div>
        </>
      )}
    </div>,
    document.body, // Render at body level to escape parent containers
  );
}
