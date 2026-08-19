import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import reminderRoutes from './routes/reminderRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import voiceRoutes from './routes/voiceRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import automationRoutes from './routes/automationRoutes.js';
import pushRoutes from './routes/pushRoutes.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/reminders', reminderRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/voice', voiceRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api/automation', automationRoutes);
  app.use('/api/push', pushRoutes);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  });

  return app;
}
