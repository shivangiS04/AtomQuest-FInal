# AtomQuest Hackathon 1.0 - Real-Time Video Support Platform

A complete real-time video calling platform built from scratch using Node.js, Express, mediasoup (SFU), React, and SQLite. All media routes through the server — no peer-to-peer connections.

## Features Implemented

### Must-Have (Core)
- ✅ **Session Management**: Agents create sessions, customers join via invite token
- ✅ **Web-Based**: Both participants join from browser (no app install)
- ✅ **Session Tracking**: Real-time participant presence + persistent history
- ✅ **Session Lifecycle**: Clean session creation, ending, and state management
- ✅ **Audio & Video Calling**: Real-time A/V via server-routed WebRTC (SFU pattern)
- ✅ **Mute/Video Toggle**: Both participants can toggle audio and video at any time
- ✅ **In-Call Chat**: Real-time text messaging with persistence
- ✅ **User Roles & Access Control**: Agent vs Customer roles with enforced permissions

### Good-to-Have (Bonus)
- ✅ **Call Recording**: Agent can start/stop recording; video saved server-side
- ✅ **File Sharing in Chat**: Upload and share files during calls
- ✅ **Reconnect Handling**: 30-second grace window for dropped connections
- ✅ **Admin Dashboard**: View all sessions, participant info, force-end sessions
- ✅ **Observability**: Prometheus metrics endpoint (`/metrics`)

## Architecture

### Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| **Media Server (SFU)** | mediasoup + Node.js | Pure WebRTC SFU, no third-party video API, server-routed media |
| **Signaling & API** | Express.js + Socket.IO | Real-time signaling over WebSocket + REST for state |
| **Database** | SQLite + better-sqlite3 | Zero external setup, fully queryable, file-based |
| **Authentication** | JWT + bcrypt | Stateless, role-based, REST + Socket.IO support |
| **Frontend** | React + Vite + Tailwind CSS | Fast, modern, no build overhead |
| **WebRTC Client** | mediasoup-client | Pairs perfectly with mediasoup server |
| **File Handling** | multer | Multipart upload, local disk storage |
| **Recording** | MediaRecorder API (browser) | No FFmpeg, stores WebM blobs server-side |
| **Metrics** | prom-client | Prometheus-compatible `/metrics` endpoint |

### High-Level Flow

```
Agent (Browser)                    Customer (Browser)
     │                                  │
     │         HTTPS / WSS              │
     └──────────────┬──────────────────┘
                    │
        ┌───────────▼──────────────┐
        │   Express + Socket.IO    │
        │   (Signaling)            │
        ├──────────────────────────┤
        │   mediasoup SFU          │
        │   (RTP routing)          │
        ├──────────────────────────┤
        │   SQLite Database        │
        │   (Persistence)          │
        └──────────────────────────┘
```

All media (audio/video) flows through the mediasoup SFU on the server. No browser-to-browser P2P.

## Installation & Running

### Prerequisites
- **Node.js** 16+ (tested on 18+)
- **npm** or **yarn**

### Backend Setup

```bash
cd backend
npm install
```

Create or verify `.env` file (already included with defaults):
```env
NODE_ENV=development
PORT=4000
JWT_SECRET=your_super_secret_jwt_key_change_in_prod
DATABASE_PATH=./data.db
MEDIASOUP_WORKER_THREADS=4
```

Start the backend:
```bash
npm run dev
```

Server will listen on `http://localhost:4000`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:5173`

### Docker (Optional)

Use the provided `Dockerfile` and `docker-compose.yml` to run both services together.

## Demo Credentials

Pre-seeded accounts (no registration required):

| Email | Password | Role |
|-------|----------|------|
| `admin@demo.com` | `admin123` | Admin |
| `agent1@demo.com` | `agent123` | Agent |
| `agent2@demo.com` | `agent123` | Agent |

## Usage Flow

### Agent Workflow
1. Login with `agent1@demo.com / agent123`
2. Click **Create Session** (e.g., "Customer Support Call")
3. Copy the **Invite Link**
4. Share link or token with customer
5. Click **Join Session** to enter the call room
6. Use controls: mute/unmute, toggle camera, start/stop recording, end call

### Customer Workflow
1. Receive invite link from agent
2. Open link → enter name → join
3. Or use **Join as Customer** tab, paste token, enter name
4. Camera/mic permissions requested
5. Joined into video call with agent
6. Can chat and share files
7. Reconnect automatically within 30 seconds if connection drops

### Admin Workflow
1. Login with `admin@demo.com / admin123`
2. View all sessions (live + history)
3. See participant names, duration, status
4. Force-end active sessions if needed

## API Endpoints

### Authentication
- `POST /api/auth/login` — Login (agent/customer)
- `POST /api/auth/register` — Create agent (admin only)

### Sessions
- `POST /api/sessions` — Create session (agent)
- `GET /api/sessions` — List agent's sessions
- `GET /api/sessions/:id` — Get session details + event log
- `POST /api/sessions/:id/end` — End session
- `GET /api/sessions/:id/chat` — Get full chat history
- `GET /api/sessions/:id/recordings` — List recordings with status

### Files
- `POST /api/files/upload` — Upload file to session
- `GET /api/files/:id` — Download file

### Admin
- `GET /api/admin/sessions` — List all sessions
- `DELETE /api/admin/sessions/:id` — Force-end session

### Utilities
- `GET /api/invite/:token` — Validate invite token
- `GET /metrics` — Prometheus metrics (active sessions, message count, etc.)

## Socket.IO Events (Signaling)

### Client → Server
- `join-room` — Join a session
- `get-rtp-capabilities` — Request media codec info
- `create-transport` — Create WebRTC transport
- `connect-transport` — Connect transport with DTLS params
- `produce` — Start sending audio/video
- `consume` — Start receiving from peer
- `resume-consumer` — Enable consumer playback
- `send-message` — Send chat message
- `share-file` — Notify file shared in chat
- `start-recording` — Begin session recording
- `stop-recording` — End recording
- `upload-recording` — Send recorded blob to server
- `end-session` — Terminate session (agent only)

### Server → Client
- `joined` — Confirm join; list existing producers
- `new-producer` — Peer started sending (trigger consume)
- `producer-closed` — Peer stopped sending
- `peer-joined` — Participant joined
- `peer-left` — Participant left
- `chat-message` — New message in room
- `file-shared` — File available for download
- `recording-started` — Recording indicator for all
- `recording-ready` — Recording ready for download
- `session-ended` — Session closed by agent

## Key Implementation Details

### Mediasoup SFU
- **Router per session**: Each call room has its own mediasoup Router
- **WebRtcTransport per peer**: Send + receive transports for full-duplex communication
- **Producers**: Audio/video tracks sent by participants
- **Consumers**: Audio/video tracks received by participants
- All RTP routed server-side; browsers do not establish direct P2P connections

### Authentication
- **JWT tokens** stored in browser `localStorage`
- **Role enforcement** on REST endpoints and Socket.IO events
- **Token refresh** not implemented (24h expiration)

### Recording
- **Browser-side**: `MediaRecorder` API captures canvas stream
- **Server-side**: Saves WebM blob to `./uploads/` directory
- **Status tracking**: `recording` → `processing` → `ready` or `failed`
- **Download**: Authenticated agents can retrieve recordings

### Reconnect Grace Window
- **30 seconds** after disconnect before peer removal
- Participant state (transports, producers, consumers) preserved
- On reconnect: clear timer, restore state, resume streams silently
- After 30s: cleanup, emit `peer-left`, log event

### Database
- **Schema**: 7 tables (users, sessions, events, messages, files, recordings)
- **Indexes** on foreign keys and frequently queried columns
- **Seeded accounts** on first run
- **WAL mode** for concurrent read/write

## Metrics & Monitoring

Endpoint: `GET /metrics`

Prometheus-compatible output:
```
atomquest_active_sessions_total 2
atomquest_connected_participants 4
atomquest_sessions_created_total 5
atomquest_messages_sent_total 25
atomquest_errors_total{error_type="webrtc"} 0
atomquest_recordings_total 1
```

Scrape this endpoint into Prometheus or Grafana for dashboards.

## Known Limitations

1. **Single-process only**: In-memory state (rooms, peers) not replicated across processes. Horizontal scaling requires Redis or shared state store.
2. **No SFU bandwidth optimization**: All video streams sent to server at full bitrate; no selective forwarding or simulcast yet.
3. **Recording format**: WebM only (H.264/VP8 depending on codec). No MP4 conversion.
4. **No audio mixing**: Each participant hears everyone separately; no conference audio mix.
5. **No presence indication**: "typing", "muted by other", etc. not implemented.
6. **Token refresh**: JWT tokens are 24-hour only; no refresh token flow.
7. **Windows path issues**: File paths hardcoded to Unix style; may need adjustment on Windows.

## Testing the Demo

### Manual Test Scenario

1. **Two windows/browsers**:
   - Window A: Login as `agent1@demo.com`, create session "Test Call"
   - Window B: Open invite link from Window A (or use token in Join tab)

2. **Validate Functionality**:
   - Both see video tiles (allow camera/mic permissions)
   - Audio works (speak, hear each other)
   - Chat: send messages from both sides
   - File sharing: upload a file in chat, click to download

3. **Recording**:
   - Agent (Window A) clicks "Start Recording" → red dot appears on both
   - Wait 10 seconds, click "Stop Recording"
   - Check `./backend/uploads/` for `.webm` file

4. **Reconnect**:
   - Customer (Window B) closes browser tab mid-call
   - Reopen invite link within 30 seconds
   - Session resumes without "left" notification

5. **Admin Dashboard**:
   - Login as `admin@demo.com`
   - See all sessions (live + ended)
   - Force-end an active session

6. **Metrics**:
   - `curl http://localhost:4000/metrics`
   - Should see active sessions, participant count, etc.

## Deployment

### Local Production
```bash
# Backend
cd backend
npm install
NODE_ENV=production npm start

# Frontend (build first)
cd frontend
npm install
npm run build
# Serve dist/ with a static server (nginx, express, etc.)
```

### Cloud (AWS/GCP/Azure)
1. Build Docker images for backend + frontend
2. Deploy backend to container service (ECS, Cloud Run, etc.)
3. Deploy frontend to CDN or static hosting
4. Point frontend API calls to backend URL
5. Ensure WebRTC ports (40000-40100) are open

### Environment Variables (Production)
```env
NODE_ENV=production
PORT=4000
JWT_SECRET=<generate-strong-secret>
DATABASE_PATH=/data/data.db  # Use persistent volume
MEDIASOUP_WORKER_THREADS=8   # Scale to CPU cores
```

## Troubleshooting

### "No camera/mic permission"
- Check browser permissions (Settings → Privacy)
- Reload page, try incognito window
- HTTPS required on production (WebRTC constraints)

### "Cannot connect to server"
- Verify backend running on port 4000
- Check firewall/proxy rules
- WebSocket connections must be allowed (Socket.IO)

### "Video feeds not appearing"
- Check browser console for errors
- Ensure mediasoup workers started (backend logs)
- Verify JWT tokens valid (24h expiration)

### "Recording not saving"
- Check `./backend/uploads/` directory writable
- Verify MediaRecorder API support (Chrome/Firefox)
- Look for errors in backend logs

## Code Quality

- **Linting**: No formal linter configured; use ESLint on integration
- **Testing**: No unit/integration tests; manual testing recommended
- **Security**: Input validation on REST endpoints; CORS enabled; JWT enforced on sockets
- **Error Handling**: Try-catch blocks around critical flows; 500 errors logged

## Performance Expectations

### Single Server (4 mediasoup workers)
- **Concurrent sessions**: 10-20 (depends on bitrate)
- **Participants per session**: 2-4 (SFU architecture; add bandwidth limits for more)
- **Message throughput**: 1000s/minute (Socket.IO optimization not applied)
- **Recording**: Real-time WebM encoding (CPU-bound)

Scale horizontally with multiple backend servers + shared database.

## Support & Contact

For issues, questions, or improvements:
- Check the GitHub Issues tab
- Review architecture diagram in `ARCHITECTURE.md`
- Examine logs: `./backend/src/server.js` console output

---

**Built for AtomQuest Hackathon 1.0 Grand Finale**

Good luck! 🚀
