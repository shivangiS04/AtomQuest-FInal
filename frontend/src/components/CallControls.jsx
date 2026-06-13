export default function CallControls({
  isAudioEnabled,
  isVideoEnabled,
  isRecording,
  isAgent,
  onToggleAudio,
  onToggleVideo,
  onToggleRecording,
  onEndCall,
}) {
  return (
    <div className="flex justify-center gap-4 p-4 bg-gray-900 rounded-lg">
      <button
        onClick={onToggleAudio}
        className={`px-6 py-2 rounded font-semibold text-white transition ${
          isAudioEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
        }`}
      >
        {isAudioEnabled ? '🔊 Audio On' : '🔇 Audio Off'}
      </button>

      <button
        onClick={onToggleVideo}
        className={`px-6 py-2 rounded font-semibold text-white transition ${
          isVideoEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
        }`}
      >
        {isVideoEnabled ? '📹 Camera On' : '📹 Camera Off'}
      </button>

      {isAgent && (
        <button
          onClick={onToggleRecording}
          className={`px-6 py-2 rounded font-semibold text-white transition ${
            isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
          }`}
        >
          {isRecording ? '⏹️ Stop Recording' : '⏺️ Start Recording'}
        </button>
      )}

      <button
        onClick={onEndCall}
        className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-semibold transition"
      >
        ☎️ End Call
      </button>
    </div>
  );
}
