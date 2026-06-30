import { config } from 'dotenv';
config({ path: '../../.env' });

// Validate environment at startup — crashes with clear message if invalid
import { env } from './env.js';

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import pino from 'pino';

// Routes
import authRouter from './routes/auth.js';
import sessionsRouter from './routes/sessions.js';
import transcriptsRouter from './routes/transcripts.js';
import reportsRouter from './routes/reports.js';
import interviewRouter from './routes/interview.js';

// Error handler (must be last)
import { errorHandler } from './middleware/errorHandler.js';

// ─── Logger ───────────────────────────────────────────────────────────────────

const logger = pino({
  name: 'api',
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();

// ── Global middleware ─────────────────────────────────────────────────────────

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/sessions', sessionsRouter);
app.use('/api/v1/transcripts', transcriptsRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/interview', interviewRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    status: 'fail',
    message: 'Route not found',
  });
});

// ── Central error handler (must be after all routes) ─────────────────────────

app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────

const server = app.listen(env.API_PORT, () => {
  logger.info(
    {
      port: env.API_PORT,
      env: env.NODE_ENV,
      frontendUrl: env.FRONTEND_URL,
    },
    `🚀  AI Interview API listening on http://localhost:${env.API_PORT}`,
  );
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function gracefulShutdown(signal: string): void {
  logger.info({ signal }, 'Received shutdown signal, closing server...');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10s if connections don't close
  setTimeout(() => {
    logger.error('Forced exit after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});

export default app;
