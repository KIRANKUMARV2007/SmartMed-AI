import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import auditLogsRouter from './routes/auditLogs.js';
import equipmentRouter from './routes/equipment.js';
import movementsRouter from './routes/movements.js';
import maintenanceRouter from './routes/maintenance.js';
import roomsRouter from './routes/rooms.js';
import aiRouter from './routes/ai.js';
import navigationRouter from './routes/navigation.js';
import reportsRouter from './routes/reports.js';

const app = express();

// Middleware
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Health Check Endpoint
// Returns server status and real-time MongoDB connection state
app.get('/api/health', (req, res) => {
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbStateCode = mongoose.connection.readyState;
  const isDbConnected = dbStateCode === 1;

  res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? 'healthy' : 'degraded',
    service: 'SmartMed AI Backend API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      connected: isDbConnected,
      state: dbStates[dbStateCode] || 'unknown',
      host: mongoose.connection.host || null,
      name: mongoose.connection.name || null,
    },
  });
});

// Authentication & Identity Routes
app.use('/api/auth', authRouter);

// Administrative User & Audit Management Routes
app.use('/api/users', usersRouter);
app.use('/api/audit-logs', auditLogsRouter);

// Clinical Domain API Routes
app.use('/api/equipment', equipmentRouter);
app.use('/api/movements', movementsRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/navigation', navigationRouter);
app.use('/api/reports', reportsRouter);

// Centralized 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);

  const isDbError =
    err.name === 'MongooseServerSelectionError' ||
    (err.name === 'MongooseError' && err.message?.includes('buffering timed out'));

  const status = isDbError
    ? 503
    : err.name === 'ValidationError'
    ? 400
    : (err.status || 500);

  const code = isDbError
    ? 'DATABASE_UNAVAILABLE'
    : err.code || (err.name === 'ValidationError' ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR');

  const message = isDbError
    ? 'Database operation unavailable. Please verify MongoDB Atlas network access and IP allowlist.'
    : err.message || 'Internal Server Error';

  res.status(status).json({
    error: message,
    code,
  });
});

export default app;
