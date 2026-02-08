import { createPortal } from "react-dom";

/**
 * ResultPopup
 *
 * Displays mood detection results or errors at the top of the viewport.
 * Uses React Portal to render outside parent positioning contexts.
 */
export default function ResultPopup({ result, show, onClose }) {
  if (!show || !result) return null;

  return createPortal(
    <div
      className={`fixed top-8 left-1/2 -translate-x-1/2 z-[9999] p-4 rounded-lg border ${
        result.success
          ? "bg-green-500/10 border-green-500/30 text-green-300"
          : "bg-yellow-500/10 border-yellow-500/30 text-yellow-300"
      } animate-fadeInUp max-w-xs text-center shadow-2xl backdrop-blur-sm`}
    >
      {result.success ? (
        <>
          <div className="text-2xl mb-2">
            {result.detected_mood === "happy" && "😊"}
            {result.detected_mood === "sad" && "😢"}
            {result.detected_mood === "angry" && "😠"}
            {result.detected_mood === "neutral" && "😐"}
          </div>
          <div className="font-semibold text-lg capitalize">
            {result.detected_mood}
          </div>
          {result.confidence && (
            <div className="text-sm opacity-80 mt-1">
              {Math.round(result.confidence * 100)}% confidence
            </div>
          )}
        </>
      ) : (
        <>
          <div className="text-2xl mb-2">⚠️</div>
          <div className="font-semibold">Unable to Detect Mood</div>
          <div className="text-xs mt-2 opacity-80">
            {result.error || "Recording not suitable for mood detection"}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
