import 'dotenv/config';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000'),
  jwtSecret: process.env.JWT_SECRET,
  databasePath: process.env.DATABASE_PATH || './data.db',
  mediasoupWorkers: parseInt(process.env.MEDIASOUP_WORKER_THREADS || '4'),
  mediasoupListenIps: ['127.0.0.1'],
  mediasoupAnnouncedIps: ['127.0.0.1'],
  mediasoupWebRtcPort: 40000,
  mediasoupPlainRtpPort: 40100,
};

export const mediasoupCodecs = {
  audio: [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
    },
  ],
  video: [
    {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {
        'x-google-start-bitrate': 1000,
      },
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
  ],
};

export const mediasoupWorkerSettings = {
  logLevel: 'warn',
  logTags: [
    'info',
    'ice',
    'dtls',
    'rtp',
    'srtp',
    'rtcp',
  ],
  rtcMinPort: 40000,
  rtcMaxPort: 40100,
};
