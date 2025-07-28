import { createServer } from 'node:http';
import { parse } from 'node:url';
import dotenv from 'dotenv';
import pino from 'pino';
import { WebSocket, WebSocketServer } from 'ws';
import { SessionManager } from './session-manager.js';
import type {
  CompleteData,
  ErrorData,
  HeartbeatData,
  LogData,
  Message,
  StatusData,
} from './types.js';
import { MessageType } from './types.js';

dotenv.config();
const logger = pino({
  name: 'websocket-server',
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

const PORT = Number.parseInt(process.env.PORT || '8080', 10);
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'default-token';
const HEARTBEAT_INTERVAL = Number.parseInt(
  process.env.HEARTBEAT_INTERVAL || '30000',
  10
); // 30 seconds

const sessionManager = new SessionManager();

interface ConnectionInfo {
  isAlive: boolean;
  lastPong: Date;
  containerID?: string;
  authenticated: boolean;
}

const connectionInfo = new WeakMap<WebSocket, ConnectionInfo>();

/**
 * Authenticate connection via query parameters.
 */
function authenticateConnection(url: string): boolean {
  try {
    const parsed = parse(url, true);
    const token = parsed.query.token;

    if (!token || token !== AUTH_TOKEN) {
      logger.warn({ url, token }, 'Authentication failed');
      return false;
    }

    logger.info({ token }, 'Connection authenticated successfully');
    return true;
  } catch (error) {
    logger.error({ error, url }, 'Error parsing authentication parameters');
    return false;
  }
}

/**
 * Parse and validate incoming message
 */
function parseMessage(data: string): Message | null {
  try {
    const parsed = JSON.parse(data);

    if (
      !parsed.type ||
      !parsed.containerID ||
      !parsed.timestamp ||
      !parsed.data
    ) {
      logger.warn({ parsed }, 'Invalid message format');
      return null;
    }

    if (!Object.values(MessageType).includes(parsed.type)) {
      logger.warn({ type: parsed.type }, 'Invalid message type');
      return null;
    }

    return parsed as Message;
  } catch (error) {
    logger.error({ error, data }, 'Failed to parse message');
    return null;
  }
}

/**
 * Handle different message types
 */
function handleMessage(ws: WebSocket, message: Message): void {
  const info = connectionInfo.get(ws);
  if (!info || !info.authenticated) {
    logger.warn(
      { containerID: message.containerID },
      'Unauthenticated client attempted to send message'
    );
    return;
  }

  logger.info(
    {
      type: message.type,
      containerID: message.containerID,
      timestamp: message.timestamp,
    },
    'Processing message'
  );

  switch (message.type) {
    case MessageType.LOG:
      handleLogMessage(message);
      break;
    case MessageType.STATUS:
      handleStatusMessage(message);
      break;
    case MessageType.ERROR:
      handleErrorMessage(message);
      break;
    case MessageType.COMPLETE:
      handleCompleteMessage(message);
      break;
    case MessageType.HEARTBEAT:
      handleHeartbeatMessage(ws, message);
      break;
    default:
      logger.warn({ type: message.type }, 'Unknown message type');
  }
}

/**
 * Handle log messages
 */
function handleLogMessage(message: Message): void {
  const logData = message.data as LogData;

  logger.info(
    {
      containerID: message.containerID,
      level: logData.level,
      logMessage: logData.message,
      metadata: logData.metadata,
    },
    'Container log'
  );

  sessionManager.broadcast(message.containerID, message);
}

/**
 * Handle status messages
 */
function handleStatusMessage(message: Message): void {
  const statusData = message.data as StatusData;

  logger.info(
    {
      containerID: message.containerID,
      status: statusData.status,
      statusMessage: statusData.message,
    },
    'Container status update'
  );

  sessionManager.broadcast(message.containerID, message);
}

/**
 * Handle error messages
 */
function handleErrorMessage(message: Message): void {
  const errorData = message.data as ErrorData;

  logger.error(
    {
      containerID: message.containerID,
      error: errorData.error,
      code: errorData.code,
      details: errorData.details,
    },
    'Container error'
  );

  sessionManager.broadcast(message.containerID, message);
}

/**
 * Handle completion messages
 */
function handleCompleteMessage(message: Message): void {
  const completeData = message.data as CompleteData;

  logger.info(
    {
      containerID: message.containerID,
      exitCode: completeData.exitCode,
      duration: completeData.duration,
      message: completeData.message,
    },
    'Container completed'
  );

  sessionManager.broadcast(message.containerID, message);
}

/**
 * Handle heartbeat messages
 */
function handleHeartbeatMessage(ws: WebSocket, message: Message): void {
  const heartbeatData = message.data as HeartbeatData;
  const info = connectionInfo.get(ws);

  if (info) {
    info.isAlive = true;
    info.lastPong = new Date();
  }

  logger.debug(
    {
      containerID: message.containerID,
      heartbeatTimestamp: heartbeatData.timestamp,
      uptime: heartbeatData.uptime,
    },
    'Heartbeat received'
  );

  const pongMessage: Message = {
    type: MessageType.HEARTBEAT,
    containerID: message.containerID,
    timestamp: new Date().toISOString(),
    data: {
      timestamp: new Date().toISOString(),
    } as HeartbeatData,
  };

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(pongMessage));
  }
}

/**
 * Send heartbeat ping to all connections
 */
function sendHeartbeatPing(): void {
  const stats = sessionManager.getStats();
  logger.debug(
    { totalConnections: stats.totalConnections },
    'Sending heartbeat ping'
  );

  const activeContainers = sessionManager.getActiveContainers();

  for (const containerID of activeContainers) {
    const pingMessage: Message = {
      type: MessageType.HEARTBEAT,
      containerID,
      timestamp: new Date().toISOString(),
      data: {
        timestamp: new Date().toISOString(),
      } as HeartbeatData,
    };

    sessionManager.broadcast(containerID, pingMessage);
  }
}

/**
 * Clean up dead connections
 */
function cleanupDeadConnections(): void {
  const sessions = sessionManager.getContainerSessions();
  let cleanedUp = 0;

  for (const session of sessions) {
    for (const ws of session.connections) {
      const info = connectionInfo.get(ws);

      if (!info || !info.isAlive) {
        logger.info(
          { containerID: session.containerID },
          'Removing dead connection'
        );
        sessionManager.removeConnection(ws);
        cleanedUp++;
      } else {
        info.isAlive = false;
      }
    }
  }

  if (cleanedUp > 0) {
    logger.info({ cleanedUp }, 'Cleaned up dead connections');
  }
}

const server = createServer();

const wss = new WebSocketServer({
  server,
  verifyClient: (info: { origin: string; req: { url?: string } }) => {
    const authenticated = authenticateConnection(info.req.url || '');
    if (!authenticated) {
      logger.warn(
        { origin: info.origin, url: info.req.url },
        'Rejecting unauthenticated connection'
      );
    }
    return authenticated;
  },
});

wss.on('connection', (ws, req) => {
  const url = req.url || '';
  const parsed = parse(url, true);
  const containerID = parsed.query.containerID as string;

  connectionInfo.set(ws, {
    isAlive: true,
    lastPong: new Date(),
    containerID,
    authenticated: true,
  });

  logger.info(
    {
      containerID,
      remoteAddress: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    },
    'WebSocket connection established'
  );

  if (containerID) {
    sessionManager.addConnection(containerID, ws);
    const welcomeMessage: Message = {
      type: MessageType.STATUS,
      containerID,
      timestamp: new Date().toISOString(),
      data: {
        status: 'running',
        message: 'Connected to container log stream',
      } as StatusData,
    };

    ws.send(JSON.stringify(welcomeMessage));
  }

  ws.on('message', (data) => {
    try {
      const message = parseMessage(data.toString());
      if (message) {
        handleMessage(ws, message);
      }
    } catch (error) {
      logger.error({ error, data: data.toString() }, 'Error handling message');
    }
  });

  ws.on('close', (code, reason) => {
    const info = connectionInfo.get(ws);
    logger.info(
      {
        containerID: info?.containerID,
        code,
        reason: reason.toString(),
      },
      'WebSocket connection closed'
    );

    connectionInfo.delete(ws);
  });

  ws.on('error', (error) => {
    const info = connectionInfo.get(ws);
    logger.error(
      {
        containerID: info?.containerID,
        error,
      },
      'WebSocket connection error'
    );
  });

  ws.on('pong', () => {
    const info = connectionInfo.get(ws);
    if (info) {
      info.isAlive = true;
      info.lastPong = new Date();
    }
  });
});

const heartbeatInterval = setInterval(() => {
  sendHeartbeatPing();
  cleanupDeadConnections();
}, HEARTBEAT_INTERVAL);

function gracefulShutdown(signal: string): void {
  logger.info(
    { signal },
    'Received shutdown signal, starting graceful shutdown'
  );

  clearInterval(heartbeatInterval);

  wss.close(() => {
    logger.info('WebSocket server closed');
  });

  sessionManager.shutdown();

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled rejection');
  gracefulShutdown('unhandledRejection');
});

server.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      authToken: `${AUTH_TOKEN.substring(0, 4)}***`,
      heartbeatInterval: HEARTBEAT_INTERVAL,
    },
    'WebSocket server started'
  );

  setInterval(() => {
    const stats = sessionManager.getStats();
    if (stats.totalConnections > 0) {
      logger.info(stats, 'Session statistics');
    }
  }, 60000);
});

export { sessionManager, logger };
