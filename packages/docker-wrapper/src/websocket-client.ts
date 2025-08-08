import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import type {
  CompleteData,
  ErrorData,
  HeartbeatData,
  LogData,
  Message,
  StatusData,
} from './types';
import { MessageType } from './types';

export interface WebSocketClientOptions {
  serverUrl: string;
  containerID: string;
  reconnectInterval?: number;
  maxRetries?: number;
  heartbeatInterval?: number;
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private containerID: string;
  private reconnectInterval: number;
  private maxRetries: number;
  private heartbeatInterval: number;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectAttempts = 0;
  private messageQueue: Message[] = [];
  private connected = false;

  constructor(options: WebSocketClientOptions) {
    super();
    this.serverUrl = options.serverUrl;
    this.containerID = options.containerID;
    this.reconnectInterval = options.reconnectInterval || 1000;
    this.maxRetries = options.maxRetries || 10;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
  }

  /**
   * Connect to the WebSocket server with exponential backoff
   */
  public async connect(): Promise<void> {
    if (this.ws) {
      this.disconnect();
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.on('open', () => {
          this.connected = true;
          this.connectAttempts = 0;
          this.emit('connected');
          this.startHeartbeat();
          this.flushMessageQueue();
          resolve();
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
          try {
            const message = JSON.parse(data.toString());
            this.emit('message', message);
          } catch (err) {
            this.emit(
              'error',
              new Error(`Failed to parse WebSocket message: ${err}`)
            );
          }
        });

        this.ws.on('close', () => {
          this.connected = false;
          this.stopHeartbeat();
          this.emit('disconnected');
          this.reconnect();
        });

        this.ws.on('error', (err: Error) => {
          this.emit('error', err);
        });
      } catch (err) {
        reject(err);
        this.reconnect();
      }
    });
  }

  /**
   * Attempt to reconnect to the WebSocket server
   */
  private reconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.connectAttempts >= this.maxRetries) {
      this.emit('failed', new Error('Maximum reconnection attempts reached'));
      return;
    }

    // Exponential backoff
    const delay = this.reconnectInterval * 2 ** this.connectAttempts;
    this.connectAttempts++;

    this.emit('reconnecting', { attempt: this.connectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((err) => {
        this.emit('error', err);
      });
    }, delay);
  }

  /**
   * Start sending heartbeats at regular intervals
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  /**
   * Stop sending heartbeats
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Send a message to the WebSocket server
   */
  private sendMessage(message: Message): void {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (err) {
      this.emit('error', new Error(`Failed to send WebSocket message: ${err}`));
      this.messageQueue.push(message);
    }
  }

  /**
   * Send all queued messages
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length > 0 && this.connected && this.ws) {
      const queue = [...this.messageQueue];
      this.messageQueue = [];

      for (const message of queue) {
        this.sendMessage(message);
      }
    }
  }

  /**
   * Send a log message
   */
  public sendLog(
    level: LogData['level'],
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    this.sendMessage({
      type: MessageType.LOG,
      containerID: this.containerID,
      timestamp: new Date().toISOString(),
      data: {
        level,
        message,
        metadata,
      } as LogData,
    });
  }

  /**
   * Send a status update
   */
  public sendStatus(status: StatusData['status'], message?: string): void {
    this.sendMessage({
      type: MessageType.STATUS,
      containerID: this.containerID,
      timestamp: new Date().toISOString(),
      data: {
        status,
        message,
      } as StatusData,
    });
  }

  /**
   * Send an error message
   */
  public sendError(
    error: string,
    code?: string,
    details?: Record<string, unknown>
  ): void {
    this.sendMessage({
      type: MessageType.ERROR,
      containerID: this.containerID,
      timestamp: new Date().toISOString(),
      data: {
        error,
        code,
        details,
      } as ErrorData,
    });
  }

  /**
   * Send a heartbeat
   */
  public sendHeartbeat(): void {
    const uptime = process.uptime();
    this.sendMessage({
      type: MessageType.HEARTBEAT,
      containerID: this.containerID,
      timestamp: new Date().toISOString(),
      data: {
        timestamp: new Date().toISOString(),
        uptime,
      } as HeartbeatData,
    });
  }

  /**
   * Send completion status
   */
  public sendComplete(
    exitCode: number,
    message?: string,
    duration?: number
  ): void {
    this.sendMessage({
      type: MessageType.COMPLETE,
      containerID: this.containerID,
      timestamp: new Date().toISOString(),
      data: {
        exitCode,
        message,
        duration,
      } as CompleteData,
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    this.connected = false;
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.removeAllListeners();

      // Only close if it's not already closing/closed
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
