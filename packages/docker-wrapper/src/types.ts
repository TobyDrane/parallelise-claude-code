/**
 * Shared types for docker-wrapper
 * Copied from websocket-server to avoid cross-package imports
 */

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
