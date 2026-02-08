/**
 * RecordButton
 *
 * A circular button for recording audio with visual feedback.
 */
export default function RecordButton({
  isRecording,
  isProcessing,
  onMouseDown,
  onMouseUp,
  onTouchStart,
  onTouchEnd,
}) {
  return (
    <button
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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
  );
}
