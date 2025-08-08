/**
 * Log Streamer
 * Streams logs from the container to the WebSocket server
 */

import { EventEmitter } from 'node:events';
import type { ParsedOutput } from './output-parser';
import { OutputType } from './output-parser';
import type { ProcessOutput } from './process-runner';
import type { ProcessStats } from './process-runner';
import { WebSocketClient } from './websocket-client';

export interface LogStreamerOptions {
  containerID: string;
  wsServerUrl: string;
  statsInterval?: number; // How often to send stats (in ms)
}

/**
 * Streams logs and events to WebSocket server
 */
export class LogStreamer extends EventEmitter {
  private wsClient: WebSocketClient;
  private containerID: string;
  private statsInterval: number;
  private statsTimer: NodeJS.Timeout | null = null;

  constructor(options: LogStreamerOptions) {
    super();
    this.containerID = options.containerID;
    this.statsInterval = options.statsInterval || 10000; // Default 10 seconds

    // Initialize WebSocket client
    this.wsClient = new WebSocketClient({
      serverUrl: options.wsServerUrl,
      containerID: options.containerID,
    });

    // Set up WebSocket event handlers
    this.setupEventHandlers();
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.wsClient.on('connected', () => {
      this.emit('connected');
    });

    this.wsClient.on('disconnected', () => {
      this.emit('disconnected');
    });

    this.wsClient.on('error', (err) => {
      this.emit('error', err);
    });

    this.wsClient.on('failed', (err) => {
      this.emit('failed', err);
    });
  }

  /**
   * Connect to the WebSocket server
   */
  public async connect(): Promise<void> {
    try {
      await this.wsClient.connect();
      this.sendStatus('starting', 'Connected to WebSocket server');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start streaming process statistics at regular intervals
   */
  public startStatsReporting(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
    }

    this.statsTimer = setInterval(() => {
      this.wsClient.sendHeartbeat();
    }, this.statsInterval);
  }

  /**
   * Stop streaming process statistics
   */
  public stopStatsReporting(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  /**
   * Stream process output
   */
  public streamOutput(output: ProcessOutput): void {
    this.wsClient.sendLog(output.isError ? 'error' : 'info', output.line);
  }

  /**
   * Stream parsed output
   */
  public streamParsedOutput(parsed: ParsedOutput): void {
    switch (parsed.type) {
      case OutputType.ERROR:
        this.wsClient.sendError(parsed.message);
        break;

      case OutputType.FILE_CHANGE:
        this.wsClient.sendLog('info', parsed.message, parsed.metadata);
        break;

      case OutputType.PROGRESS:
        this.wsClient.sendLog('info', parsed.message, parsed.metadata);
        break;

      case OutputType.COMPLETION:
        this.wsClient.sendLog('info', parsed.message);
        break;

      default:
        this.wsClient.sendLog('info', parsed.message);
        break;
    }
  }

  /**
   * Stream process statistics
   */
  public streamStats(stats: ProcessStats): void {
    this.wsClient.sendLog('info', 'Resource usage', {
      memory: `${Math.round(stats.memoryUsage.rss / 1024 / 1024)} MB`,
      cpu: `${stats.cpuUsage.user / 1000000} s`,
      uptime: `${Math.round(stats.uptime)} s`,
    });
  }

  /**
   * Send status update
   */
  public sendStatus(
    status: 'starting' | 'running' | 'completed' | 'failed',
    message?: string
  ): void {
    this.wsClient.sendStatus(status, message);
  }

  /**
   * Send log message
   */
  public sendLog(
    level: 'info' | 'error',
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    this.wsClient.sendLog(level, message, metadata);
  }

  /**
   * Send error message
   */
  public sendError(
    error: string,
    code?: string,
    details?: Record<string, unknown>
  ): void {
    this.wsClient.sendError(error, code, details);
  }

  /**
   * Send completion status
   */
  public sendComplete(
    exitCode: number,
    message?: string,
    duration?: number
  ): void {
    this.wsClient.sendComplete(exitCode, message, duration);
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.stopStatsReporting();
    this.wsClient.disconnect();
  }
}
