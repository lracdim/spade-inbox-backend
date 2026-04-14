import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { authRouter } from './routes/auth.js';
import { messagesRouter } from './routes/messages.js';
import { usersRouter } from './routes/users.js';
import { ingestRouter } from './routes/ingest.js';
import { setupRouter } from './routes/setup.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

export const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: 'https://inbox.spadesecurityservices.com',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  },
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join', (userId: number) => {
    socket.join(`user:${userId}`);
    console.log(`User ${userId} joined room user:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

app.use(cors({
  origin: 'https://inbox.spadesecurityservices.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.header('Pragma', 'no-cache');
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/users', usersRouter);
app.use('/api/ingest', ingestRouter);
app.use('/api/setup', setupRouter);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;