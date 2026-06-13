import { useEffect, useState, useContext, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext.jsx';
import { useMediasoup } from '../hooks/useMediasoup.js';
import VideoGrid from '../components/VideoGrid.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import CallControls from '../components/CallControls.jsx';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export default function CallRoom() {
  const { id: sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);

  const customerToken = searchParams.get('customer');
  const customerName = searchParams.get('name') || 'Customer';
  const isCustomer = Boolean(customerToken);
  const isAgent = !isCustomer && user?.role === 'agent';

  const myName = isCustomer ? customerName : (user?.name || user?.email || 'Agent');
  const myRole = isCustomer ? 'customer' : 'agent';
  const authToken = isCustomer ? customerToken : token;

  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const recordingIdRef = useRef(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Connecting...');
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const callReadyRef = useRef(false);
  const pendingProducersRef = useRef([]);

  const msoup = useMediasoup();

  const consumeSafe = useCallback(async (socket, producerId, peerName) => {
    try {
      await msoup.consumeProducer(socket, sessionId, producerId, peerName);
    } catch (err) {
      console.warn('[consumeSafe] failed:', producerId, err.message);
    }
  }, [sessionId, msoup]);

  const startCall = useCallback(async (socket) => {
    try {
      setStatus('Getting camera & microphone...');
      const stream = await msoup.startLocalMedia();

      setStatus('Setting up media connection...');

      const rtpCapabilities = await new Promise((resolve, reject) => {
        const onError = (err) => {
          socket.off('error', onError);
          reject(typeof err === 'string' ? new Error(err) : err);
        };
        socket.emit('get-rtp-capabilities', { sessionId });
        socket.once('rtp-capabilities', (caps) => {
          socket.off('error', onError);
          resolve(caps);
        });
        socket.once('error', onError);
      });
      await msoup.loadDevice(rtpCapabilities);

      const sendParams = await new Promise((resolve, reject) => {
        const onError = (err) => {
          socket.off('error', onError);
          reject(typeof err === 'string' ? new Error(err) : err);
        };
        socket.emit('create-transport', { sessionId, direction: 'send' });
        socket.once('send-transport-created', (params) => {
          socket.off('error', onError);
          resolve(params);
        });
        socket.once('error', onError);
        setTimeout(() => reject(new Error('send-transport timeout')), 10000);
      });
      msoup.createSendTransport(socket, sessionId, sendParams);

      const recvParams = await new Promise((resolve, reject) => {
        const onError = (err) => {
          socket.off('error', onError);
          reject(typeof err === 'string' ? new Error(err) : err);
        };
        socket.emit('create-transport', { sessionId, direction: 'recv' });
        socket.once('recv-transport-created', (params) => {
          socket.off('error', onError);
          resolve(params);
        });
        socket.once('error', onError);
        setTimeout(() => reject(new Error('recv-transport timeout')), 10000);
      });
      msoup.createRecvTransport(socket, sessionId, recvParams);

      setStatus('Connecting to call...');
      await msoup.produceMedia(stream);

      setStatus('');
      setError('');
      setConnected(true);
      callReadyRef.current = true;
    } catch (err) {
      console.error('startCall error:', err);
      setError(err.message || 'Failed to start call');
      setStatus('');
    }
  }, [sessionId, msoup]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token: isCustomer ? 'customer' : authToken },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-room', {
        sessionId,
        token: authToken,
        name: myName,
        role: myRole,
      });
    });

    socket.on('joined', async ({ producers }) => {
      await startCall(socket);

      // Process any producers that arrived while startCall was running
      const pending = [...pendingProducersRef.current];
      pendingProducersRef.current = [];
      const allProducers = [...producers, ...pending];

      for (const item of allProducers) {
        const producerId = typeof item === 'string' ? item : item.producerId;
        const peerName = (typeof item === 'object' && item.peerName) ? item.peerName : 'Remote Peer';
        await consumeSafe(socket, producerId, peerName);
      }
    });

    socket.on('new-producer', async ({ producerId, kind, peerName }) => {
      if (!callReadyRef.current) {
        // startCall still running — queue for later
        pendingProducersRef.current.push({ producerId, peerName });
        return;
      }
      await consumeSafe(socket, producerId, peerName || 'Remote Peer');
    });

    socket.on('producer-closed', ({ producerId }) => {
      msoup.setRemoteStreams((prev) => prev.filter((s) => s.producerId !== producerId));
    });

    socket.on('chat-message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('peer-joined', ({ name }) => {
      setStatus(`${name} joined`);
      setTimeout(() => setStatus(''), 3000);
    });

    socket.on('peer-left', ({ name }) => {
      setStatus(`${name} left the call`);
      setTimeout(() => setStatus(''), 3000);
    });

    socket.on('recording-started', ({ recordingId: rid }) => {
      recordingIdRef.current = rid;
      setIsRecording(true);
    });

    socket.on('recording-stopped', () => {
      setIsRecording(false);
    });

    socket.on('recording-ready', () => {
      setStatus('Recording ready for download');
      setTimeout(() => setStatus(''), 4000);
    });

    socket.on('session-ended', () => {
      msoup.cleanup();
      alert('The session has ended');
      navigate(isAgent ? '/dashboard' : '/');
    });

    socket.on('error', (msg) => {
      const errMsg = typeof msg === 'string' ? msg : 'Connection error';
      console.error('Socket error:', errMsg);
      if (!callReadyRef.current) {
        setError(errMsg);
      }
    });

    return () => {
      callReadyRef.current = false;
      msoup.cleanup();
      socket.disconnect();
    };
  }, []);

  const handleSendMessage = useCallback((content) => {
    socketRef.current?.emit('send-message', { sessionId, content });
  }, [sessionId]);

  const handleSendFile = useCallback((fileData) => {
    socketRef.current?.emit('share-file', { sessionId, fileId: fileData.id });
    const message = {
      id: fileData.id,
      session_id: sessionId,
      sender_name: myName,
      sender_role: myRole,
      content: fileData.original_name,
      message_type: 'file',
      file_id: fileData.id,
      timestamp: Math.floor(Date.now() / 1000),
    };
    setMessages((prev) => [...prev, message]);
  }, [sessionId, myName, myRole]);

  const handleToggleRecording = useCallback(async () => {
    if (!isRecording) {
      socketRef.current?.emit('start-recording', { sessionId });

      const combinedStream = new MediaStream();
      if (msoup.localStream) {
        msoup.localStream.getTracks().forEach((t) => combinedStream.addTrack(t));
      }

      mediaRecorderRef.current = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp8,opus' });
      recordedChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        blob.arrayBuffer().then((buffer) => {
          socketRef.current?.emit('upload-recording', {
            sessionId,
            recordingId: recordingIdRef.current,
            data: buffer,
            mimeType: 'video/webm',
          });
        });
      };

      mediaRecorderRef.current.start(1000);
    } else {
      mediaRecorderRef.current?.stop();
      socketRef.current?.emit('stop-recording', { sessionId, recordingId: recordingIdRef.current });
    }
  }, [isRecording, sessionId, msoup.localStream]);

  const handleEndCall = useCallback(() => {
    if (isAgent) {
      socketRef.current?.emit('end-session', { sessionId });
    }
    msoup.cleanup();
    socketRef.current?.disconnect();
    navigate(isAgent ? '/dashboard' : '/');
  }, [isAgent, sessionId, navigate, msoup]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800 shadow">
        <h1 className="text-xl font-bold text-white">
          {isAgent ? 'Support Session' : 'Call Room'}
        </h1>
        <div className="flex items-center gap-4">
          {status && <span className="text-sm text-yellow-300">{status}</span>}
          {isRecording && (
            <span className="flex items-center gap-1 text-red-400 font-semibold text-sm animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
              REC
            </span>
          )}
          <span className="text-sm text-gray-400">
            {connected ? '🟢 Connected' : '🔴 Connecting...'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-2 p-3 bg-red-700 text-white rounded text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="flex flex-1 gap-4 p-4 min-h-0 overflow-hidden">
        <VideoGrid localStream={msoup.localStream} remoteStreams={msoup.remoteStreams} />
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          onSendFile={handleSendFile}
          sessionId={sessionId}
          userName={myName}
        />
      </div>

      <div className="px-4 pb-4">
        <CallControls
          isAudioEnabled={msoup.isAudioEnabled}
          isVideoEnabled={msoup.isVideoEnabled}
          isRecording={isRecording}
          isAgent={isAgent}
          onToggleAudio={msoup.toggleAudio}
          onToggleVideo={msoup.toggleVideo}
          onToggleRecording={handleToggleRecording}
          onEndCall={handleEndCall}
        />
      </div>
    </div>
  );
}
