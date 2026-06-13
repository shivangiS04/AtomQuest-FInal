import * as mediasoup from 'mediasoup';
import { config } from '../config.js';

const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: { 'x-google-start-bitrate': 1000 },
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'level-asymmetry-allowed': 1,
      'packetization-mode': 1,
      'profile-level-id': '42e01f',
      'x-google-start-bitrate': 1000,
    },
  },
];

let workers = [];
let workerIdx = 0;
const routers = new Map();

export async function initMediasoup() {
  const numWorkers = Math.min(config.mediasoupWorkers, 4);
  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    });

    worker.on('died', () => {
      console.error(`mediasoup worker ${worker.pid} died, restarting...`);
      workers = workers.filter((w) => w !== worker);
      initWorker().then((w) => workers.push(w));
    });

    workers.push(worker);
  }
  console.log(`mediasoup: ${workers.length} workers ready`);
}

async function initWorker() {
  const worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  });
  worker.on('died', () => {
    console.error(`mediasoup worker ${worker.pid} died`);
    workers = workers.filter((w) => w !== worker);
  });
  return worker;
}

function nextWorker() {
  const w = workers[workerIdx % workers.length];
  workerIdx++;
  return w;
}

export async function createRouter(sessionId) {
  if (routers.has(sessionId)) return routers.get(sessionId);
  const worker = nextWorker();
  const router = await worker.createRouter({ mediaCodecs });
  routers.set(sessionId, router);
  return router;
}

export function getRouter(sessionId) {
  return routers.get(sessionId);
}

export function closeRouter(sessionId) {
  const router = routers.get(sessionId);
  if (router) {
    try { router.close(); } catch {}
    routers.delete(sessionId);
  }
}

export function getAllRouters() {
  return Array.from(routers.entries());
}
