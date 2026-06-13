import { useRef, useState, useCallback } from 'react';
import { Device } from 'mediasoup-client';

export function useMediasoup() {
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const producersRef = useRef(new Map());
  const consumersRef = useRef(new Map());

  const loadDevice = useCallback(async (routerRtpCapabilities) => {
    if (deviceRef.current) return deviceRef.current;
    const device = new Device();
    await device.load({ routerRtpCapabilities });
    deviceRef.current = device;
    return device;
  }, []);

  const createSendTransport = useCallback((socket, sessionId, transportParams) => {
    const device = deviceRef.current;
    if (!device) throw new Error('Device not loaded');

    const transport = device.createSendTransport({
      id: transportParams.id,
      iceParameters: transportParams.iceParameters,
      iceCandidates: transportParams.iceCandidates,
      dtlsParameters: transportParams.dtlsParameters,
      sctpParameters: transportParams.sctpParameters,
    });

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      socket.emit('connect-transport', {
        sessionId,
        transportId: transport.id,
        dtlsParameters,
      });
      socket.once('send-transport-connected', callback);
    });

    transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
      socket.emit('produce', {
        sessionId,
        transportId: transport.id,
        kind,
        rtpParameters,
        appData,
      });
      socket.once('producer-created', ({ id }) => callback({ id }));
    });

    sendTransportRef.current = transport;
    return transport;
  }, []);

  const createRecvTransport = useCallback((socket, sessionId, transportParams) => {
    const device = deviceRef.current;
    if (!device) throw new Error('Device not loaded');

    const transport = device.createRecvTransport({
      id: transportParams.id,
      iceParameters: transportParams.iceParameters,
      iceCandidates: transportParams.iceCandidates,
      dtlsParameters: transportParams.dtlsParameters,
      sctpParameters: transportParams.sctpParameters,
    });

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      socket.emit('connect-transport', {
        sessionId,
        transportId: transport.id,
        dtlsParameters,
      });
      socket.once('recv-transport-connected', callback);
    });

    recvTransportRef.current = transport;
    return transport;
  }, []);

  const startLocalMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 30 },
        audio: true,
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('getUserMedia failed:', err);
      throw err;
    }
  }, []);

  const produceMedia = useCallback(async (stream) => {
    const transport = sendTransportRef.current;
    if (!transport) throw new Error('Send transport not created');

    const tracks = {
      video: stream.getVideoTracks()[0],
      audio: stream.getAudioTracks()[0],
    };

    for (const [kind, track] of Object.entries(tracks)) {
      if (!track) continue;
      try {
        const producer = await transport.produce({ track });
        producersRef.current.set(producer.id, producer);
      } catch (err) {
        console.error(`Failed to produce ${kind}:`, err);
      }
    }
  }, []);

  const consumeProducer = useCallback(async (socket, sessionId, producerId, peerName) => {
    const device = deviceRef.current;
    if (!device) return;

    return new Promise((resolve, reject) => {
      const transport = recvTransportRef.current;
      if (!transport) {
        return reject(new Error('Recv transport not ready'));
      }

      socket.emit('consume', {
        sessionId,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      });

      const handler = async (params) => {
        if (params.producerId !== producerId) return;
        socket.off('consumer-created', handler);

        try {
          const consumer = await transport.consume({
            id: params.id,
            producerId: params.producerId,
            kind: params.kind,
            rtpParameters: params.rtpParameters,
          });

          consumersRef.current.set(consumer.id, consumer);
          socket.emit('resume-consumer', { sessionId, consumerId: consumer.id });

          const track = consumer.track;
          const kind = consumer.kind;
          const stream = new MediaStream([track]);

          setRemoteStreams((prev) => [
            ...prev,
            { id: consumer.id, producerId, kind, name: peerName || 'Remote', stream },
          ]);

          resolve(consumer);
        } catch (err) {
          reject(err);
        }
      };

      socket.on('consumer-created', handler);
    });
  }, []);

  const toggleAudio = useCallback(() => {
    if (!localStream) return;
    const enabled = !isAudioEnabled;
    localStream.getAudioTracks().forEach((t) => { t.enabled = enabled; });
    setIsAudioEnabled(enabled);
  }, [localStream, isAudioEnabled]);

  const toggleVideo = useCallback(() => {
    if (!localStream) return;
    const enabled = !isVideoEnabled;
    localStream.getVideoTracks().forEach((t) => { t.enabled = enabled; });
    setIsVideoEnabled(enabled);
  }, [localStream, isVideoEnabled]);

  const cleanup = useCallback(() => {
    localStream?.getTracks().forEach((t) => t.stop());
    for (const producer of producersRef.current.values()) producer.close();
    for (const consumer of consumersRef.current.values()) consumer.close();
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    producersRef.current.clear();
    consumersRef.current.clear();
    setLocalStream(null);
    setRemoteStreams([]);
  }, [localStream]);

  return {
    device: deviceRef.current,
    localStream,
    remoteStreams,
    isAudioEnabled,
    isVideoEnabled,
    loadDevice,
    createSendTransport,
    createRecvTransport,
    startLocalMedia,
    produceMedia,
    consumeProducer,
    toggleAudio,
    toggleVideo,
    cleanup,
    setRemoteStreams,
  };
}
