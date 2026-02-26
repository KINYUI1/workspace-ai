import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import type { AuthPayload } from '../../api/middleware/auth';

let io: Server | null = null;

/**
 * Initialize Socket.io server with JWT authentication.
 */
export function initializeWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
    pingInterval: 25_000,
    pingTimeout: 10_000,
  });

  // Authentication middleware for WebSocket connections
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token as string;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      socket.data.userId = payload.userId;
      socket.data.email = payload.email;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    logger.info('WebSocket connected', { userId, socketId: socket.id });

    // Join user-specific room for targeted events
    socket.join(`user:${userId}`);

    socket.on('join:agent', (agentId: string) => {
      socket.join(`agent:${agentId}`);
      logger.debug('Socket joined agent room', { socketId: socket.id, agentId });
    });

    socket.on('join:team', (teamId: string) => {
      socket.join(`team:${teamId}`);
      logger.debug('Socket joined team room', { socketId: socket.id, teamId });
    });

    socket.on('leave:agent', (agentId: string) => {
      socket.leave(`agent:${agentId}`);
    });

    socket.on('leave:team', (teamId: string) => {
      socket.leave(`team:${teamId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info('WebSocket disconnected', { userId, socketId: socket.id, reason });
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

/**
 * Get the Socket.io server instance.
 */
export function getIO(): Server {
  if (!io) {
    throw new Error('WebSocket server not initialized');
  }
  return io;
}

// --- Emit Helpers -----------------------------------------------------------

export function emitToUser(userId: string, event: string, data: unknown): void {
  getIO().to(`user:${userId}`).emit(event, data);
}

export function emitToAgent(agentId: string, event: string, data: unknown): void {
  getIO().to(`agent:${agentId}`).emit(event, data);
}

export function emitToTeam(teamId: string, event: string, data: unknown): void {
  getIO().to(`team:${teamId}`).emit(event, data);
}

export function emitGlobal(event: string, data: unknown): void {
  getIO().emit(event, data);
}

// --- Stream Helpers ----------------------------------------------------------

export function emitStreamEvent(userId: string, event: string, data: unknown): void {
  getIO().to(`user:${userId}`).emit(event, data);
}

export function emitLog(userId: string, entry: {
  level: 'debug' | 'info' | 'warn' | 'error';
  source: 'agent' | 'system' | 'task' | 'tool';
  message: string;
  agentName?: string;
  details?: Record<string, unknown>;
}): void {
  getIO().to(`user:${userId}`).emit('system:log', {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
}
