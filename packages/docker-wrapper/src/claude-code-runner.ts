import { spawn } from 'node:child_process';
import { exec } from 'node:child_process';
/**
 * Claude Code Runner
 * Specialized wrapper for running Claude Code binary aligned with official GitHub Action
 */
import { EventEmitter } from 'node:events';
import { createWriteStream } from 'node:fs';
import { stat, unlink, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { ProcessOutput } from './process-runner';

const execAsync = promisify(exec);

export interface ClaudeCodeOptions {
  workingDirectory: string;
  task: string;
  timeout?: number;
  allowedTools?: string;
  disallowedTools?: string;
  maxTurns?: string;
  mcpConfig?: string;
  systemPrompt?: string;
  appendSystemPrompt?: string;
  claudeEnv?: string;
  fallbackModel?: string;
  model?: string;
  extraArgs?: string[];
}

export interface ClaudeCodeResult {
  exitCode: number;
  duration: number;
  success: boolean;
  output: string;
}

export type ClaudeOutputCallback = (output: ProcessOutput) => void;

export class ClaudeCodeRunner extends EventEmitter {
  private startTime = 0;
  private options: ClaudeCodeOptions;
  private claudeCodePath = 'claude';
  private workspaceTemp: string;
  private pipePath: string;
  private executionFile: string;

  private static readonly BASE_ARGS = [
    '-p',
    '--verbose',
    '--output-format',
    'stream-json',
  ];

  constructor(options: ClaudeCodeOptions) {
    super();
    this.options = options;
    this.workspaceTemp = `${options.workingDirectory}/.tmp`;
    this.pipePath = `${this.workspaceTemp}/claude_prompt_pipe`;
    this.executionFile = `${this.workspaceTemp}/claude-execution-output.json`;
  }

  /**
   * Parse custom environment variables from claudeEnv option
   */
  private parseCustomEnvVars(claudeEnv?: string): Record<string, string> {
    if (!claudeEnv || claudeEnv.trim() === '') {
      return {};
    }

    const customEnv: Record<string, string> = {};
    const lines = claudeEnv.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        continue;
      }

      const colonIndex = trimmedLine.indexOf(':');
      if (colonIndex === -1) {
        continue;
      }

      const key = trimmedLine.substring(0, colonIndex).trim();
      const value = trimmedLine.substring(colonIndex + 1).trim();

      if (key) {
        customEnv[key] = value;
      }
    }

    return customEnv;
  }

  /**
   * Prepare Claude run configuration matching official implementation
   */
  private prepareRunConfig(): {
    claudeArgs: string[];
    env: Record<string, string>;
  } {
    const claudeArgs = [...ClaudeCodeRunner.BASE_ARGS];

    if (this.options.allowedTools) {
      claudeArgs.push('--allowedTools', this.options.allowedTools);
    }
    if (this.options.disallowedTools) {
      claudeArgs.push('--disallowedTools', this.options.disallowedTools);
    }
    if (this.options.maxTurns) {
      const maxTurnsNum = Number.parseInt(this.options.maxTurns, 10);
      if (Number.isNaN(maxTurnsNum) || maxTurnsNum <= 0) {
        throw new Error(
          `maxTurns must be a positive number, got: ${this.options.maxTurns}`
        );
      }
      claudeArgs.push('--max-turns', this.options.maxTurns);
    }
    if (this.options.mcpConfig) {
      claudeArgs.push('--mcp-config', this.options.mcpConfig);
    }
    if (this.options.systemPrompt) {
      claudeArgs.push('--system-prompt', this.options.systemPrompt);
    }
    if (this.options.appendSystemPrompt) {
      claudeArgs.push(
        '--append-system-prompt',
        this.options.appendSystemPrompt
      );
    }
    if (this.options.fallbackModel) {
      claudeArgs.push('--fallback-model', this.options.fallbackModel);
    }
    if (this.options.model) {
      claudeArgs.push('--model', this.options.model);
    }

    const customEnv = this.parseCustomEnvVars(this.options.claudeEnv);

    return { claudeArgs, env: customEnv };
  }

  /**
   * Create task prompt file for Claude
   */
  private async createTaskPrompt(): Promise<string> {
    const promptPath = `${this.workspaceTemp}/task-prompt.txt`;
    await writeFile(promptPath, this.options.task);
    return promptPath;
  }

  /**
   * Pretty print JSON output from Claude
   */
  private processOutputLine(
    line: string,
    outputCallback?: ClaudeOutputCallback
  ): void {
    if (line.trim() === '') return;

    try {
      // Try to parse as JSON and pretty print
      const parsed = JSON.parse(line);
      const prettyJson = JSON.stringify(parsed, null, 2);

      const output: ProcessOutput = {
        line: prettyJson,
        isError: false,
        timestamp: new Date(),
      };

      this.emit('output', output);
      outputCallback?.(output);
    } catch {
      // Not JSON, output as is
      const output: ProcessOutput = {
        line,
        isError: false,
        timestamp: new Date(),
      };

      this.emit('output', output);
      outputCallback?.(output);
    }
  }

  /**
   * Execute Claude Code with the provided task using official implementation pattern
   */
  public async run(
    outputCallback?: ClaudeOutputCallback
  ): Promise<ClaudeCodeResult> {
    this.startTime = Date.now();

    try {
      const config = this.prepareRunConfig();
      await execAsync(`mkdir -p "${this.workspaceTemp}"`);

      const promptPath = await this.createTaskPrompt();

      try {
        await unlink(this.pipePath);
      } catch {}

      await execAsync(`mkfifo "${this.pipePath}"`);

      let promptSize = 'unknown';
      try {
        const stats = await stat(promptPath);
        promptSize = stats.size.toString();
      } catch {
        // Ignore error
      }

      console.log(`Prompt file size: ${promptSize} bytes`);
      if (Object.keys(config.env).length > 0) {
        const envKeys = Object.keys(config.env).join(', ');
        console.log(`Custom environment variables: ${envKeys}`);
      }

      console.log(`Running Claude with prompt from file: ${promptPath}`);

      const catProcess = spawn('cat', [promptPath], {
        stdio: ['ignore', 'pipe', 'inherit'],
      });
      const pipeStream = createWriteStream(this.pipePath);
      catProcess.stdout.pipe(pipeStream);

      catProcess.on('error', (error) => {
        console.error('Error reading prompt file:', error);
        pipeStream.destroy();
      });

      // Start Claude process
      const claudeProcess = spawn(this.claudeCodePath, config.claudeArgs, {
        stdio: ['pipe', 'pipe', 'inherit'],
        env: {
          ...process.env,
          ...config.env,
        },
        cwd: this.options.workingDirectory,
      });

      // Handle Claude process errors
      claudeProcess.on('error', (error) => {
        console.error('Error spawning Claude process:', error);
        pipeStream.destroy();
      });

      // Capture and process output
      let output = '';
      claudeProcess.stdout.on('data', (data) => {
        const text = data.toString();
        const lines = text.split('\n');

        for (const [index, line] of lines.entries()) {
          if (line.trim() === '' && index === lines.length - 1) continue;
          this.processOutputLine(line, outputCallback);
        }

        output += text;
      });

      // Handle stdout errors
      claudeProcess.stdout.on('error', (error) => {
        console.error('Error reading Claude stdout:', error);
      });

      // Pipe from named pipe to Claude
      const pipeProcess = spawn('cat', [this.pipePath]);
      pipeProcess.stdout.pipe(claudeProcess.stdin);

      // Handle pipe process errors
      pipeProcess.on('error', (error) => {
        console.error('Error reading from named pipe:', error);
        claudeProcess.kill('SIGTERM');
      });

      let timeoutMs = 10 * 60 * 1000; // Default 10 minutes
      if (this.options.timeout) {
        timeoutMs = this.options.timeout;
      }

      // Wait for Claude to finish with timeout
      const exitCode = await new Promise<number>((resolve) => {
        let resolved = false;

        const timeoutId = setTimeout(() => {
          if (!resolved) {
            console.error(
              `Claude process timed out after ${timeoutMs / 1000} seconds`
            );
            claudeProcess.kill('SIGTERM');

            // Force kill after 5 seconds
            setTimeout(() => {
              try {
                claudeProcess.kill('SIGKILL');
              } catch {
                // Process may already be dead
              }
            }, 5000);

            resolved = true;
            resolve(124);
          }
        }, timeoutMs);

        claudeProcess.on('close', (code) => {
          if (!resolved) {
            clearTimeout(timeoutId);
            resolved = true;
            resolve(code || 0);
          }
        });

        claudeProcess.on('error', (error) => {
          if (!resolved) {
            console.error('Claude process error:', error);
            clearTimeout(timeoutId);
            resolved = true;
            resolve(1);
          }
        });
      });

      try {
        catProcess.kill('SIGTERM');
      } catch {
        // Process may already be dead
      }
      try {
        pipeProcess.kill('SIGTERM');
      } catch {
        // Process may already be dead
      }

      try {
        await unlink(this.pipePath);
      } catch {
        // Ignore errors during cleanup
      }

      if (exitCode === 0 && output) {
        try {
          await writeFile(`${this.workspaceTemp}/output.txt`, output);
          const { stdout: jsonOutput } = await execAsync(
            `jq -s '.' "${this.workspaceTemp}/output.txt"`
          );
          await writeFile(this.executionFile, jsonOutput);
          console.log(`Log saved to ${this.executionFile}`);
        } catch (e) {
          console.warn(`Failed to process output for execution metrics: ${e}`);
        }
      }

      const duration = Date.now() - this.startTime;

      return {
        exitCode,
        duration,
        success: exitCode === 0,
        output,
      };
    } catch (error) {
      const duration = Date.now() - this.startTime;

      this.emit('error', error);

      return {
        exitCode: 1,
        duration,
        success: false,
        output: '',
      };
    }
  }

  /**
   * Terminate the Claude Code process
   */
  public kill(): void {
    console.log('Claude process termination requested');
  }

  /**
   * Set the path to the Claude Code binary
   */
  public setBinaryPath(path: string): void {
    this.claudeCodePath = path;
  }
}
