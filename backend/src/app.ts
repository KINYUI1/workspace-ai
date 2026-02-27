import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { apiRouter } from './api/routes';
import { errorHandler } from './api/middleware/error-handler';
import { logger } from './utils/logger';

export function createApp(options?: { skipCatchAll?: boolean }): express.Application {
  const app = express();

  // ---------------------------------------------------------------------------
  // Security & Performance Middleware
  // ---------------------------------------------------------------------------

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
          fontSrc: ["'self'", 'fonts.gstatic.com', 'cdn.jsdelivr.net'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'wss:', 'ws:'],
          workerSrc: ["'self'", 'blob:'],
        },
      },
    }),
  );

  // CORS
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  );

  // Gzip compression
  app.use(compression());

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
      },
    }),
  );

  // ---------------------------------------------------------------------------
  // Body Parsing
  // ---------------------------------------------------------------------------

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ---------------------------------------------------------------------------
  // Request Logging
  // ---------------------------------------------------------------------------

  const morganFormat = env.NODE_ENV === 'production' ? 'combined' : 'dev';
  app.use(
    morgan(morganFormat, {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    }),
  );

  // ---------------------------------------------------------------------------
  // Health Check
  // ---------------------------------------------------------------------------

  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.1.0',
    });
  });

  // ---------------------------------------------------------------------------
  // API Routes
  // ---------------------------------------------------------------------------

  app.use('/api', apiRouter);

  // ---------------------------------------------------------------------------
  // Production SPA — serve frontend static files
  // ---------------------------------------------------------------------------

  if (env.NODE_ENV === 'production' && !options?.skipCatchAll) {
    const frontendDir = path.join(__dirname, '../../../../frontend/dist');
    app.use(express.static(frontendDir));
    // SPA fallback: any non-API route serves index.html
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendDir, 'index.html'));
    });
  }

  // ---------------------------------------------------------------------------
  // 404 Handler (skipped in desktop mode and production SPA)
  // ---------------------------------------------------------------------------

  if (!options?.skipCatchAll && env.NODE_ENV !== 'production') {
    app.use((_req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested endpoint does not exist',
        },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Error Handler (must be last)
  // ---------------------------------------------------------------------------

  app.use(errorHandler);

  return app;
}
