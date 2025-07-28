import type { WebSocket } from 'ws';

export enum MessageType {
  LOG = 'LOG',
  ERROR = 'ERROR',
  STATUS = 'STATUS',
  HEARTBEAT = 'HEARTBEAT',
  COMPLETE = 'COMPLETE',
}

export interface Message {
  type: MessageType;
  containerID: string;
  timestamp: string;
  data: LogData | StatusData | ErrorData | HeartbeatData | CompleteData;
}

export interface LogData {
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface StatusData {
  status: 'starting' | 'running' | 'completed' | 'failed';
  message?: string;
}

export interface ErrorData {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface HeartbeatData {
  timestamp: string;
  uptime?: number;
}

export interface CompleteData {
  exitCode: number;
  message?: string;
  duration?: number;
}

export interface WebSocketConnection {
  ws: WebSocket;
  containerID: string;
  clientID: string;
  connectedAt: Date;
}

export interface SessionStats {
  totalConnections: number;
  activeContainers: number;
  connectionsPerContainer: Record<string, number>;
}

export interface ContainerSession {
  containerID: string;
  connections: Set<WebSocket>;
  createdAt: Date;
  lastActivity: Date;
}
