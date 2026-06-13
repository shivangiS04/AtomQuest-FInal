import express from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import {
  createSession,
  findSessionById,
  findSessionByInviteToken,
  getAgentSessions,
  getSessionEvents,
  getSessionMessages,
  getSessionFiles,
  getSessionRecordings,
} from '../db/index.js';

const router = express.Router();

router.post('/', authMiddleware, roleGuard(['agent']), (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title required' });
  }

  const session = createSession(req.user.userId, title);
  const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/join/${session.invite_token}`;

  res.status(201).json({
    session,
    inviteUrl,
  });
});

router.get('/', authMiddleware, roleGuard(['agent']), (req, res) => {
  const sessions = getAgentSessions(req.user.userId);
  res.json(sessions);
});

router.get('/:id', authMiddleware, roleGuard(['agent']), (req, res) => {
  const session = findSessionById(req.params.id);
  if (!session || session.agent_id !== req.user.userId) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const events = getSessionEvents(req.params.id);
  res.json({ session, events });
});

router.post('/:id/end', authMiddleware, roleGuard(['agent']), (req, res) => {
  const session = findSessionById(req.params.id);
  if (!session || session.agent_id !== req.user.userId) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Mark session as ended
  res.json({ message: 'Session ended' });
});

router.get('/:id/chat', authMiddleware, roleGuard(['agent']), (req, res) => {
  const session = findSessionById(req.params.id);
  if (!session || session.agent_id !== req.user.userId) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const messages = getSessionMessages(req.params.id);
  res.json(messages);
});

router.get('/:id/files', authMiddleware, roleGuard(['agent']), (req, res) => {
  const session = findSessionById(req.params.id);
  if (!session || session.agent_id !== req.user.userId) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const files = getSessionFiles(req.params.id);
  res.json(files);
});

router.get('/:id/recordings', authMiddleware, roleGuard(['agent']), (req, res) => {
  const session = findSessionById(req.params.id);
  if (!session || session.agent_id !== req.user.userId) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const recordings = getSessionRecordings(req.params.id);
  res.json(recordings);
});

export default router;
