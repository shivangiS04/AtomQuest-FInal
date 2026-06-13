import { useEffect, useRef } from 'react';

function RemoteVideo({ name, stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black/70 text-white px-3 py-1 rounded text-sm font-medium">
        {name}
      </div>
    </div>
  );
}

function RemoteAudio({ stream }) {
  return (
    <audio
      autoPlay
      ref={(el) => {
        if (el && stream) {
          el.srcObject = stream;
          el.play().catch(() => {});
        }
      }}
    />
  );
}

export default function VideoGrid({ localStream, remoteStreams = [] }) {
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const videoStreams = remoteStreams.filter((s) => s.kind === 'video');
  const audioStreams = remoteStreams.filter((s) => s.kind === 'audio');

  const totalTiles = 1 + videoStreams.length + (videoStreams.length === 0 ? 1 : 0);
  const cols = totalTiles <= 2 ? 2 : 3;

  return (
    <div className="flex-1 bg-black rounded-lg overflow-hidden p-2">
      {audioStreams.map(({ id, stream }) => (
        <RemoteAudio key={id} stream={stream} />
      ))}

      <div
        className="h-full grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/70 text-white px-3 py-1 rounded text-sm font-medium">
            You (Local)
          </div>
        </div>

        {videoStreams.map(({ id, name, stream }) => (
          <RemoteVideo key={id} name={name} stream={stream} />
        ))}

        {videoStreams.length === 0 && (
          <div className="flex flex-col items-center justify-center bg-gray-800 rounded-lg text-gray-400 gap-2">
            <div className="text-4xl">👤</div>
            <p className="text-sm">Waiting for other participant...</p>
          </div>
        )}
      </div>
    </div>
  );
}
