import Database from 'better-sqlite3';
import { config } from '../config.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('agent','admin')),
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      agent_id TEXT NOT NULL REFERENCES users(id),
      invite_token TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('waiting','active','ended')),
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      ended_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS session_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      participant_name TEXT NOT NULL,
      participant_role TEXT NOT NULL,
      event TEXT NOT NULL CHECK(event IN ('joined','left')),
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      content TEXT,
      message_type TEXT NOT NULL CHECK(message_type IN ('text','file')),
      file_id TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploader_name TEXT NOT NULL,
      uploaded_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      status TEXT NOT NULL CHECK(status IN ('recording','processing','ready','failed')),
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      file_path TEXT,
      duration INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_invite_token ON sessions(invite_token);
    CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_files_session_id ON files(session_id);
    CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id);
  `);

  seedDefaultUsers();
}

function seedDefaultUsers() {
  const adminExists = db.prepare('SELECT 1 FROM users WHERE email = ?').get('admin@demo.com');
  if (adminExists) return;

  const now = Math.floor(Date.now() / 1000);
  const users = [
    { email: 'admin@demo.com', password: 'admin123', role: 'admin', name: 'Admin User' },
    { email: 'agent1@demo.com', password: 'agent123', role: 'agent', name: 'Agent One' },
    { email: 'agent2@demo.com', password: 'agent123', role: 'agent', name: 'Agent Two' },
  ];

  const stmt = db.prepare(`
    INSERT INTO users (id, email, password_hash, role, name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const user of users) {
    const hash = bcrypt.hashSync(user.password, 10);
    stmt.run(uuidv4(), user.email, hash, user.role, user.name, now);
  }
}

export function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function findUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function createSession(agentId, title) {
  const id = uuidv4();
  const token = uuidv4();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT INTO sessions (id, title, agent_id, invite_token, status, created_at)
    VALUES (?, ?, ?, ?, 'waiting', ?)
  `).run(id, title, agentId, token, now);

  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
}

export function findSessionById(id) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
}

export function findSessionByInviteToken(token) {
  return db.prepare('SELECT * FROM sessions WHERE invite_token = ?').get(token);
}

export function getAgentSessions(agentId) {
  return db.prepare('SELECT * FROM sessions WHERE agent_id = ? ORDER BY created_at DESC').all(agentId);
}

export function getAllSessions() {
  return db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all();
}

export function updateSessionStatus(sessionId, status) {
  const now = Math.floor(Date.now() / 1000);
  const update = status === 'active' ? 'started_at' : 'ended_at';
  db.prepare(`UPDATE sessions SET status = ?, ${update} = ? WHERE id = ?`).run(status, now, sessionId);
}

export function addSessionEvent(sessionId, participantName, participantRole, event) {
  const id = uuidv4();
  const timestamp = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO session_events (id, session_id, participant_name, participant_role, event, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, participantName, participantRole, event, timestamp);
}

export function getSessionEvents(sessionId) {
  return db.prepare('SELECT * FROM session_events WHERE session_id = ? ORDER BY timestamp ASC').all(sessionId);
}

export function addMessage(sessionId, senderName, senderRole, content, messageType = 'text', fileId = null) {
  const id = uuidv4();
  const timestamp = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO messages (id, session_id, sender_name, sender_role, content, message_type, file_id, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, senderName, senderRole, content, messageType, fileId, timestamp);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
}

export function getSessionMessages(sessionId) {
  return db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC').all(sessionId);
}

export function addFile(sessionId, originalName, storedName, mimeType, size, uploaderName) {
  const id = uuidv4();
  const uploadedAt = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO files (id, session_id, original_name, stored_name, mime_type, size, uploader_name, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, originalName, storedName, mimeType, size, uploaderName, uploadedAt);
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id);
}

export function findFileById(id) {
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id);
}

export function getSessionFiles(sessionId) {
  return db.prepare('SELECT * FROM files WHERE session_id = ? ORDER BY uploaded_at DESC').all(sessionId);
}

export function createRecording(sessionId) {
  const id = uuidv4();
  const startedAt = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO recordings (id, session_id, status, started_at)
    VALUES (?, ?, 'recording', ?)
  `).run(id, sessionId, startedAt);
  return db.prepare('SELECT * FROM recordings WHERE id = ?').get(id);
}

export function updateRecording(recordingId, updates) {
  const { status, endedAt, filePath, duration } = updates;
  const fields = [];
  const values = [];

  if (status !== undefined) { fields.push('status = ?'); values.push(status); }
  if (endedAt !== undefined) { fields.push('ended_at = ?'); values.push(endedAt); }
  if (filePath !== undefined) { fields.push('file_path = ?'); values.push(filePath); }
  if (duration !== undefined) { fields.push('duration = ?'); values.push(duration); }

  values.push(recordingId);
  db.prepare(`UPDATE recordings SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function findRecordingById(id) {
  return db.prepare('SELECT * FROM recordings WHERE id = ?').get(id);
}

export function getSessionRecordings(sessionId) {
  return db.prepare('SELECT * FROM recordings WHERE session_id = ? ORDER BY started_at DESC').all(sessionId);
}

export default db;
