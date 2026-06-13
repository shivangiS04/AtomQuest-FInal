import express from 'express';
import { Server } from 'socket.io';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import 'dotenv/config';
import { config } from './config.js';
import {
  initDb,
  findSessionByInviteToken,
  findRecordingById,
} from './db/index.js';
import { initMediasoup } from './mediasoup/index.js';
import { setupSocket, getRooms } from './socket/index.js';
import { setIO } from './routes/admin.js';
import { authMiddleware, roleGuard } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/sessions.js';
import fileRoutes from './routes/files.js';
import adminRoutes from './routes/admin.js';
import metricsRoutes from './routes/metrics.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 100 * 1024 * 1024,
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/metrics', metricsRoutes);

app.get('/api/invite/:token', (req, res) => {
  const session = findSessionByInviteToken(req.params.token);
  if (!session) return res.status(404).json({ error: 'Invalid invite token' });
  res.json({ session });
});

app.get('/api/recordings/:id/download', authMiddleware, roleGuard(['agent', 'admin']), (req, res) => {
  const recording = findRecordingById(req.params.id);
  if (!recording || recording.status !== 'ready') {
    return res.status(404).json({ error: 'Recording not found or not ready' });
  }
  const filePath = path.resolve(recording.file_path);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.download(filePath, `recording-${req.params.id}.webm`);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/debug/rooms', (req, res) => {
  const rooms = getRooms();
  const state = {};
  for (const [sessionId, room] of rooms) {
    state[sessionId] = {
      peers: {},
    };
    for (const [socketId, peer] of room.peers) {
      state[sessionId].peers[socketId] = {
        name: peer.name,
        role: peer.role,
        transports: [...peer.transports.entries()].map(([id, t]) => ({ id, direction: t.direction })),
        producers: [...peer.producers.keys()],
        consumers: [...peer.consumers.keys()],
      };
    }
  }
  res.json(state);
});

async function start() {
  console.log('Initializing database...');
  initDb();

  console.log('Initializing mediasoup workers...');
  await initMediasoup();

  setIO(io);
  setupSocket(io);

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`✅ Server running on http://localhost:${config.port}`);
    console.log(`📊 Metrics: http://localhost:${config.port}/metrics`);
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
