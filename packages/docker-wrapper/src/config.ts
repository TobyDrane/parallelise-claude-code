import * as os from 'node:os';
import path from 'node:path';
/**
 * Configuration management for the docker wrapper
 * Validates and provides typed access to environment variables
 */
import dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

export interface Config {
  // Required configurations
  repoUrl: string;
  task: string;
  wsServer: string;
  containerID: string;

  // Optional configurations with defaults
  timeout: number;
  logLevel: string;
  workspaceDir: string;

  // Authentication
  githubToken?: string;

  // Claude Code specific options
  allowedTools?: string;
  disallowedTools?: string;
  maxTurns?: string;
  mcpConfig?: string;
  systemPrompt?: string;
  appendSystemPrompt?: string;
  claudeEnv?: string;
  fallbackModel?: string;
  model?: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(`Configuration Error: ${message}`);
    this.name = 'ConfigError';
  }
}

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  const repoUrl = getRequiredEnv('REPO_URL');
  const task = getRequiredEnv('TASK');
  const wsServer = getRequiredEnv('WS_SERVER');

  const containerID =
    process.env.CONTAINER_ID ||
    (() => {
      const host = os.hostname();
      return host.length > 8
        ? host
        : `container-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    })();

  const timeout = Number.parseInt(process.env.TIMEOUT || '1800000', 10);
  const logLevel = process.env.LOG_LEVEL || 'info';
  const workspaceDir = process.env.WORKSPACE_DIR || '/workspace';

  const githubToken = process.env.GITHUB_TOKEN;

  const allowedTools = process.env.ALLOWED_TOOLS;
  const disallowedTools = process.env.DISALLOWED_TOOLS;
  const maxTurns = process.env.MAX_TURNS;
  const mcpConfig = process.env.MCP_CONFIG;
  const systemPrompt = process.env.SYSTEM_PROMPT;
  const appendSystemPrompt = process.env.APPEND_SYSTEM_PROMPT;
  const claudeEnv = process.env.CLAUDE_ENV;
  const fallbackModel = process.env.FALLBACK_MODEL;
  const model = process.env.MODEL || 'claude-4-sonnet';

  return {
    repoUrl,
    task,
    wsServer,
    containerID,
    timeout,
    logLevel,
    workspaceDir,
    githubToken,
    allowedTools,
    disallowedTools,
    maxTurns,
    mcpConfig,
    systemPrompt,
    appendSystemPrompt,
    claudeEnv,
    fallbackModel,
    model,
  };
}

/**
 * Get a required environment variable or throw an error
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Validate URL format
 */
export function validateRepoUrl(url: string): boolean {
  // Basic validation for git URLs
  const httpsPattern = /^https:\/\/([^\/]+)\/([^\/]+)\/([^\/\.]+)(\.git)?$/;
  const sshPattern = /^git@([^:]+):([^\/]+)\/([^\/\.]+)(\.git)?$/;

  return httpsPattern.test(url) || sshPattern.test(url);
}

/**
 * Validate WebSocket URL format
 */
export function validateWsUrl(url: string): boolean {
  const wsPattern = /^wss?:\/\/[^\s\/$.?#].[^\s]*$/i;
  return wsPattern.test(url);
}

// Export a singleton instance
export const config = loadConfig();
