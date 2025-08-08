import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as os from 'node:os';

export interface ProcessRunnerOptions {
  timeout?: number; // In milliseconds, default is 30 minutes
  workingDirectory?: string;
  env?: Record<string, string>;
}

export interface ProcessStats {
  cpuUsage: NodeJS.CpuUsage;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
}

export interface ProcessOutput {
  line: string;
  isError: boolean;
  timestamp: Date;
}

export type OutputCallback = (output: ProcessOutput) => void;

/**
 * Manages external process execution and monitoring
 */
export class ProcessRunner extends EventEmitter {
  private process: ChildProcess | null = null;
  private timeout: number;
  private workingDirectory: string;
  private env: Record<string, string>;
  private timeoutTimer: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  private startTime = 0;
  private outputBuffer = {
    stdout: '',
    stderr: '',
  };

  constructor(options: ProcessRunnerOptions = {}) {
    super();
    this.timeout = options.timeout || 30 * 60 * 1000;
    this.workingDirectory = options.workingDirectory || process.cwd();
    this.env = options.env || {};

    this.handleProcessSignals();
  }

  /**
   * Set up signal handlers to ensure clean process termination
   */
  private handleProcessSignals(): void {
    const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];

    for (const signal of signals) {
      process.on(signal, () => {
        this.kill();
        process.exit(0);
      });
    }
  }

  /**
   * Run a command with arguments
   */
  public async run(
    command: string,
    args: string[],
    outputCallback?: OutputCallback
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        this.startTime = Date.now();
        this.process = spawn(command, args, {
          cwd: this.workingDirectory,
          env: { ...process.env, ...this.env },
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        this.setupTimeout();
        this.startStatsMonitoring();
        this.setupOutputHandling(outputCallback);

        this.process.on('exit', (code, signal) => {
          this.cleanup();

          if (signal) {
            reject(new Error(`Process was killed by signal: ${signal}`));
          } else {
            resolve(code || 0);
          }
        });

        this.process.on('error', (err) => {
          this.cleanup();
          reject(err);
        });
      } catch (error) {
        this.cleanup();
        reject(error);
      }
    });
  }

  /**
   * Set up the timeout timer
   */
  private setupTimeout(): void {
    if (this.timeout > 0) {
      this.timeoutTimer = setTimeout(() => {
        this.emit('timeout');
        this.kill();
      }, this.timeout);
    }
  }

  /**
   * Start monitoring resource usage
   */
  private startStatsMonitoring(): void {
    this.statsInterval = setInterval(() => {
      if (this.process?.pid) {
        const stats: ProcessStats = {
          cpuUsage: process.cpuUsage(),
          memoryUsage: process.memoryUsage(),
          uptime: (Date.now() - this.startTime) / 1000,
        };

        this.emit('stats', stats);
      }
    }, 5000);
  }

  /**
   * Set up handlers for process output
   */
  private setupOutputHandling(outputCallback?: OutputCallback): void {
    if (!this.process) return;

    this.process.stdout?.on('data', (data) => {
      const output = data.toString();
      this.processOutput(output, false, outputCallback);
    });

    this.process.stderr?.on('data', (data) => {
      const output = data.toString();
      this.processOutput(output, true, outputCallback);
    });
  }

  /**
   * Process output text, splitting into lines and handling partial lines
   */
  private processOutput(
    text: string,
    isError: boolean,
    outputCallback?: OutputCallback
  ): void {
    const bufferKey = isError ? 'stderr' : 'stdout';
    const lines = (this.outputBuffer[bufferKey] + text).split('\n');

    this.outputBuffer[bufferKey] = lines.pop() || '';

    for (const line of lines) {
      if (line) {
        const output: ProcessOutput = {
          line,
          isError,
          timestamp: new Date(),
        };

        this.emit('output', output);

        if (outputCallback) {
          outputCallback(output);
        }
      }
    }
  }

  /**
   * Kill the child process and all its children
   */
  public kill(): void {
    if (this.process) {
      if (os.platform() === 'win32' && this.process.pid) {
        try {
          spawn('taskkill', ['/pid', this.process.pid.toString(), '/f', '/t']);
        } catch (err) {
          this.process.kill('SIGKILL');
        }
      } else {
        if (this.process.pid) {
          try {
            process.kill(-this.process.pid, 'SIGKILL');
          } catch (err) {
            this.process.kill('SIGKILL');
          }
        }
      }
    }

    this.cleanup();
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    for (const key of ['stdout', 'stderr'] as Array<
      keyof typeof this.outputBuffer
    >) {
      if (this.outputBuffer[key]) {
        this.emit('output', {
          line: this.outputBuffer[key],
          isError: key === 'stderr',
          timestamp: new Date(),
        });
        this.outputBuffer[key] = '';
      }
    }
  }
}
