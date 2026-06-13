# AtomQuest — Real-Time Video Support Platform

A real-time video calling platform for customer support. Agents create sessions, customers join via invite link. All media routes through a server-side SFU — no peer-to-peer connections.

## Features

**Core**
- Session management with invite-token based access
- Server-routed audio/video calling (mediasoup SFU)
- Mute / camera toggle for both participants
- Real-time chat with message persistence
- File sharing in chat
- Role-based access control (agent / customer / admin)

**Bonus**
- Call recording (agent-initiated, saved server-side)
- 30-second reconnect grace window
- Admin dashboard with session history and force-end
- Prometheus metrics at `/metrics`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Media Server | mediasoup (SFU) + Node.js |
| Signaling & API | Express + Socket.IO |
| Database | SQLite (better-sqlite3) |
| Auth | JWT + bcryptjs |
| Frontend | React + Vite + Tailwind CSS |
| WebRTC Client | mediasoup-client |
| File Handling | multer |
| Metrics | prom-client |

## Architecture

```
Agent (Browser)                Customer (Browser)
      |                               |
      |         HTTPS / WSS           |
      +---------------+---------------+
                      |
          +-----------+-----------+
          |  Express + Socket.IO  |
          |  (Signaling / REST)   |
          +-----------+-----------+
          |   mediasoup SFU       |
          |   (RTP routing)       |
          +-----------+-----------+
          |   SQLite Database     |
          +-----------------------+
```

All audio/video flows through the server. Browsers never connect directly to each other.

## Setup

### Prerequisites
- Node.js 18+

### Backend

```bash
cd backend
npm install
npm rebuild mediasoup
node src/server.js
```

Runs on `http://localhost:4000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`

## Demo Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@demo.com | admin123 | Admin |
| agent1@demo.com | agent123 | Agent |
| agent2@demo.com | agent123 | Agent |

## Usage

**Agent**
1. Login as agent
2. Create a session
3. Copy the invite link and share it with the customer
4. Click Join Call

**Customer**
1. Open the invite link
2. Enter your name
3. Allow camera and microphone

**Admin**
1. Login as admin
2. View all sessions (live and ended)
3. Force-end sessions if needed

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | Login |
| GET | `/api/sessions` | agent | List sessions |
| POST | `/api/sessions` | agent | Create session |
| GET | `/api/invite/:token` | — | Validate invite |
| POST | `/api/files/upload` | — | Upload file |
| GET | `/api/files/:id` | — | Download file |
| GET | `/api/admin/sessions` | admin | All sessions |
| DELETE | `/api/admin/sessions/:id` | admin | Force-end |
| GET | `/metrics` | — | Prometheus metrics |

## Metrics

```
atomquest_active_sessions_total
atomquest_connected_participants
atomquest_sessions_created_total
atomquest_messages_sent_total
atomquest_errors_total
atomquest_recordings_total
```

## Environment Variables

```env
PORT=4000
JWT_SECRET=your_secret_here
DATABASE_PATH=./data.db
MEDIASOUP_WORKER_THREADS=4
```
