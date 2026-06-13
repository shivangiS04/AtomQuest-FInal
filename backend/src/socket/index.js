import { verifyToken } from '../middleware/auth.js';
import { createRouter, getRouter, closeRouter } from '../mediasoup/index.js';
import {
  findSessionById,
  findSessionByInviteToken,
  updateSessionStatus,
  addSessionEvent,
  addMessage,
  createRecording,
  updateRecording,
} from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const rooms = new Map();
const reconnectTimers = new Map();
const RECONNECT_GRACE = 30_000;

export function setupSocket(io) {
  io.on('connection', (socket) => {
    let currentSessionId = null;
    let currentPeerKey = null;

    socket.on('join-room', async ({ sessionId, token, name, role }) => {
      try {
        const session = findSessionById(sessionId);
        if (!session) return socket.emit('error', 'Session not found');

        if (session.status === 'ended') return socket.emit('error', 'Session already ended');

        if (role === 'agent') {
          const decoded = verifyToken(token);
          if (!decoded || decoded.userId !== session.agent_id) {
            return socket.emit('error', 'Unauthorized');
          }
        } else {
          if (session.invite_token !== token) {
            return socket.emit('error', 'Invalid invite token');
          }
        }

        currentSessionId = sessionId;
        currentPeerKey = `${sessionId}:${name}`;

        const existingTimer = reconnectTimers.get(currentPeerKey);
        if (existingTimer) {
          clearTimeout(existingTimer);
          reconnectTimers.delete(currentPeerKey);
        }

        if (!rooms.has(sessionId)) {
          await createRouter(sessionId);
          rooms.set(sessionId, {
            router: getRouter(sessionId),
            peers: new Map(),
          });
          updateSessionStatus(sessionId, 'active');
        }

        const room = rooms.get(sessionId);

        // Clean up any stale peer entry with the same name (from a previous connection)
        for (const [oldSocketId, oldPeer] of room.peers) {
          if (oldPeer.name === name && oldSocketId !== socket.id) {
            for (const [, p] of oldPeer.producers) p.close();
            for (const [, c] of oldPeer.consumers) c.close();
            for (const [, t] of oldPeer.transports) t.transport.close();
            room.peers.delete(oldSocketId);
            console.log(`[join-room] cleaned up stale peer for ${name}`);
          }
        }

        room.peers.set(socket.id, {
          name,
          role,
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
        });

        socket.join(`session:${sessionId}`);
        addSessionEvent(sessionId, name, role, 'joined');

        const existingProducers = [];
        for (const [, peer] of room.peers) {
          if (peer !== room.peers.get(socket.id)) {
            for (const [producerId] of peer.producers) {
              existingProducers.push({ producerId, peerName: peer.name });
            }
          }
        }

        socket.emit('joined', { producers: existingProducers });
        socket.to(`session:${sessionId}`).emit('peer-joined', { name, role });
      } catch (err) {
        console.error('join-room:', err);
        socket.emit('error', err.message);
      }
    });

    socket.on('get-rtp-capabilities', ({ sessionId }) => {
      const router = getRouter(sessionId);
      if (!router) return socket.emit('error', 'Room not ready');
      socket.emit('rtp-capabilities', router.rtpCapabilities);
    });

    socket.on('create-transport', async ({ sessionId, direction }) => {
      try {
        const room = rooms.get(sessionId);
        const router = getRouter(sessionId);
        if (!room || !router) return socket.emit('error', 'Room not ready');

        const peer = room.peers.get(socket.id);
        if (!peer) {
          console.error(`[create-transport] peer not found for socket ${socket.id} in session ${sessionId}`);
          return socket.emit('error', 'Peer not found');
        }

        const transport = await router.createWebRtcTransport({
          listenInfos: [{ protocol: 'udp', ip: '0.0.0.0', announcedAddress: '127.0.0.1' }],
          enableTcp: true,
          preferUdp: true,
        });

        peer.transports.set(transport.id, { transport, direction });
        console.log(`[create-transport] ${direction} transport created for ${peer.name}, total transports: ${peer.transports.size}`);

        socket.emit(`${direction}-transport-created`, {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        });
      } catch (err) {
        console.error('create-transport:', err);
        socket.emit('error', err.message);
      }
    });

    socket.on('connect-transport', async ({ sessionId, transportId, dtlsParameters }) => {
      try {
        const room = rooms.get(sessionId);
        const peer = room?.peers.get(socket.id);
        const transportData = peer?.transports.get(transportId);
        if (!transportData) return socket.emit('error', 'Transport not found');

        await transportData.transport.connect({ dtlsParameters });
        socket.emit(`${transportData.direction}-transport-connected`);
      } catch (err) {
        console.error('connect-transport:', err);
        socket.emit('error', err.message);
      }
    });

    socket.on('produce', async ({ sessionId, transportId, kind, rtpParameters, appData }) => {
      try {
        const room = rooms.get(sessionId);
        const peer = room?.peers.get(socket.id);
        const transportData = peer?.transports.get(transportId);
        if (!transportData) return socket.emit('error', 'Transport not found');

        const producer = await transportData.transport.produce({ kind, rtpParameters, appData });
        peer.producers.set(producer.id, producer);

        producer.on('transportclose', () => {
          producer.close();
          peer.producers.delete(producer.id);
        });

        socket.emit('producer-created', { id: producer.id, kind });
        socket.to(`session:${sessionId}`).emit('new-producer', { producerId: producer.id, kind, peerName: peer.name });
      } catch (err) {
        console.error('produce:', err);
        socket.emit('error', err.message);
      }
    });

    socket.on('consume', async ({ sessionId, producerId, rtpCapabilities }) => {
      try {
        const room = rooms.get(sessionId);
        const router = getRouter(sessionId);
        const peer = room?.peers.get(socket.id);
        if (!room || !router || !peer) return socket.emit('error', 'Room not ready');

        console.log(`[consume] peer=${peer.name} transports=${peer.transports.size} directions=[${[...peer.transports.values()].map(t=>t.direction).join(',')}]`);

        if (!router.canConsume({ producerId, rtpCapabilities })) {
          return socket.emit('error', 'Cannot consume producer');
        }

        let recvTransport = null;
        for (const [, t] of peer.transports) {
          if (t.direction === 'recv') { recvTransport = t.transport; break; }
        }
        if (!recvTransport) return socket.emit('error', 'No recv transport');

        const consumer = await recvTransport.consume({
          producerId,
          rtpCapabilities,
          paused: true,
        });

        peer.consumers.set(consumer.id, consumer);

        consumer.on('transportclose', () => {
          consumer.close();
          peer.consumers.delete(consumer.id);
        });

        socket.emit('consumer-created', {
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        });
      } catch (err) {
        console.error('consume:', err);
        socket.emit('error', err.message);
      }
    });

    socket.on('resume-consumer', async ({ sessionId, consumerId }) => {
      try {
        const room = rooms.get(sessionId);
        const peer = room?.peers.get(socket.id);
        const consumer = peer?.consumers.get(consumerId);
        if (!consumer) return socket.emit('error', 'Consumer not found');
        await consumer.resume();
        socket.emit('consumer-resumed');
      } catch (err) {
        console.error('resume-consumer:', err);
        socket.emit('error', err.message);
      }
    });

    socket.on('send-message', ({ sessionId, content }) => {
      const room = rooms.get(sessionId);
      const peer = room?.peers.get(socket.id);
      if (!peer) return;
      const msg = addMessage(sessionId, peer.name, peer.role, content, 'text');
      io.to(`session:${sessionId}`).emit('chat-message', msg);
    });

    socket.on('share-file', ({ sessionId, fileId }) => {
      socket.to(`session:${sessionId}`).emit('file-shared', { fileId });
    });

    socket.on('start-recording', ({ sessionId }) => {
      const room = rooms.get(sessionId);
      const peer = room?.peers.get(socket.id);
      if (!peer || peer.role !== 'agent') return socket.emit('error', 'Agent only');

      const recording = createRecording(sessionId);
      io.to(`session:${sessionId}`).emit('recording-started', { recordingId: recording.id });
    });

    socket.on('stop-recording', ({ sessionId, recordingId }) => {
      io.to(`session:${sessionId}`).emit('recording-stopped', { recordingId });
    });

    socket.on('upload-recording', ({ sessionId, recordingId, data, mimeType }) => {
      try {
        if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads', { recursive: true });
        const filename = `${recordingId}.webm`;
        const filepath = path.join('./uploads', filename);
        fs.writeFileSync(filepath, Buffer.from(data));

        updateRecording(recordingId, {
          status: 'ready',
          endedAt: Math.floor(Date.now() / 1000),
          filePath: filepath,
          duration: null,
        });

        io.to(`session:${sessionId}`).emit('recording-ready', { recordingId });
      } catch (err) {
        console.error('upload-recording:', err);
        updateRecording(recordingId, { status: 'failed' });
      }
    });

    socket.on('end-session', ({ sessionId }) => {
      try {
        const session = findSessionById(sessionId);
        if (!session) return socket.emit('error', 'Session not found');

        const room = rooms.get(sessionId);
        if (room) {
          for (const [, peer] of room.peers) {
            for (const [, p] of peer.producers) p.close();
            for (const [, c] of peer.consumers) c.close();
            for (const [, t] of peer.transports) t.transport.close();
          }
          rooms.delete(sessionId);
        }

        updateSessionStatus(sessionId, 'ended');
        closeRouter(sessionId);

        io.to(`session:${sessionId}`).emit('session-ended', { reason: 'Call ended by agent' });
      } catch (err) {
        console.error('end-session:', err);
        socket.emit('error', err.message);
      }
    });

    socket.on('disconnect', () => {
      if (!currentSessionId || !currentPeerKey) return;

      const room = rooms.get(currentSessionId);
      if (!room) return;
      const peer = room.peers.get(socket.id);
      if (!peer) return;

      const timer = setTimeout(() => {
        const r = rooms.get(currentSessionId);
        if (!r) return;
        const p = r.peers.get(socket.id);
        if (!p) return;

        for (const [, producer] of p.producers) producer.close();
        for (const [, consumer] of p.consumers) consumer.close();
        for (const [, t] of p.transports) t.transport.close();

        r.peers.delete(socket.id);
        reconnectTimers.delete(currentPeerKey);

        io.to(`session:${currentSessionId}`).emit('peer-left', { name: p.name });
        addSessionEvent(currentSessionId, p.name, p.role, 'left');
      }, RECONNECT_GRACE);

      reconnectTimers.set(currentPeerKey, timer);
    });
  });
}

export function getRooms() {
  return rooms;
}
