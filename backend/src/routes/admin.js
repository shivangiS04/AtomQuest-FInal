import express from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { getAllSessions, findSessionById, getSessionEvents } from '../db/index.js';
import { closeRouter } from '../mediasoup/index.js';

const router = express.Router();
let io = null;

export function setIO(ioInstance) {
  io = ioInstance;
}

router.get('/sessions', authMiddleware, roleGuard(['admin']), (req, res) => {
  const sessions = getAllSessions();
  res.json(sessions);
});

router.delete('/sessions/:id', authMiddleware, roleGuard(['admin']), (req, res) => {
  const session = findSessionById(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (io) {
    const room = `session:${req.params.id}`;
    io.to(room).emit('session-ended', { reason: 'Admin closed session' });
  }

  closeRouter(req.params.id);

  res.json({ message: 'Session closed' });
});

export default router;
