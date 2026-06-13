import express from 'express';
import { register, Counter, Gauge } from 'prom-client';

const router = express.Router();

export const metrics = {
  activeSessions: new Gauge({
    name: 'atomquest_active_sessions_total',
    help: 'Number of currently active sessions',
  }),
  connectedParticipants: new Gauge({
    name: 'atomquest_connected_participants',
    help: 'Number of currently connected participants',
  }),
  sessionsCreated: new Counter({
    name: 'atomquest_sessions_created_total',
    help: 'Total number of sessions created',
  }),
  messagesSent: new Counter({
    name: 'atomquest_messages_sent_total',
    help: 'Total number of chat messages sent',
  }),
  errors: new Counter({
    name: 'atomquest_errors_total',
    help: 'Total number of errors',
    labelNames: ['error_type'],
  }),
  recordingsCompleted: new Counter({
    name: 'atomquest_recordings_total',
    help: 'Total number of completed recordings',
  }),
};

router.get('/', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

export default router;
