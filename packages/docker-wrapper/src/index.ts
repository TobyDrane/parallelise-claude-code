/**
 * Main entry point for the Docker wrapper
 * Connects to WebSocket server, clones repo, and runs Claude Code
 */

import fs from 'node:fs';
import { ClaudeCodeRunner } from './claude-code-runner';
import { config } from './config';
import { GitManager } from './git-manager';
import { LogStreamer } from './log-streamer';

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('uncaughtException', handleError);
process.on('unhandledRejection', handleError);

let gitManager: GitManager;
let claudeCodeRunner: ClaudeCodeRunner;
let logStreamer: LogStreamer;

/**
 * Main execution function
 */
async function main() {
  try {
    fs.writeFileSync('/tmp/.ready', 'ready');

    logStreamer = new LogStreamer({
      containerID: config.containerID,
      wsServerUrl: config.wsServer,
    });

    logStreamer.on('error', handleError);
    logStreamer.sendStatus('starting', 'Initializing container');
    await logStreamer.connect();
    logStreamer.sendLog(
      'info',
      `Connected to WebSocket server: ${config.wsServer}`
    );
    logStreamer.sendLog('info', `Running task: ${config.task}`);

    logStreamer.startStatsReporting();

    gitManager = new GitManager({
      workspaceDir: config.workspaceDir,
      githubToken: config.githubToken,
    });

    logStreamer.sendLog('info', `Validating repository: ${config.repoUrl}`);
    const isValid = await gitManager.validateRepository(config.repoUrl);
    if (!isValid) {
      throw new Error(`Repository is not accessible: ${config.repoUrl}`);
    }

    logStreamer.sendStatus('running', 'Cloning repository');
    logStreamer.sendLog('info', `Cloning repository to ${config.workspaceDir}`);

    await gitManager.cloneRepository(config.repoUrl, (event) => {
      logStreamer.sendLog('info', `Git progress: ${event.progress}%`);
    });

    const commitHash = await gitManager.getCurrentCommit();
    logStreamer.sendLog('info', `Repository cloned, commit: ${commitHash}`);

    claudeCodeRunner = new ClaudeCodeRunner({
      workingDirectory: config.workspaceDir,
      task: config.task,
      timeout: config.timeout,
      allowedTools: config.allowedTools,
      disallowedTools: config.disallowedTools,
      maxTurns: config.maxTurns,
      mcpConfig: config.mcpConfig,
      systemPrompt: config.systemPrompt,
      appendSystemPrompt: config.appendSystemPrompt,
      claudeEnv: config.claudeEnv,
      fallbackModel: config.fallbackModel,
      model: config.model,
    });

    claudeCodeRunner.on('output', (output) => {
      logStreamer.streamOutput(output);
    });

    claudeCodeRunner.on('error', (error) => {
      logStreamer.sendError(error.message);
    });

    logStreamer.sendStatus('running', 'Executing Claude Code');
    logStreamer.sendLog('info', 'Starting Claude Code execution');

    const result = await claudeCodeRunner.run((output) => {
      logStreamer.streamOutput(output);
    });

    if (result.success) {
      logStreamer.sendStatus('completed', 'Task completed successfully');
      logStreamer.sendComplete(
        result.exitCode,
        'Task completed successfully',
        result.duration
      );
    } else {
      logStreamer.sendStatus(
        'failed',
        `Task failed with exit code ${result.exitCode}`
      );
      logStreamer.sendComplete(
        result.exitCode,
        `Task failed with exit code ${result.exitCode}`,
        result.duration
      );
    }
  } catch (error) {
    handleError(error);
  } finally {
    await cleanup();
  }
}

/**
 * Handle errors
 */
function handleError(error: unknown) {
  console.error('RAW ERROR OBJECT:', error);
  if (error instanceof AggregateError) {
    for (const inner of error.errors) {
      console.error(' └─ inner:', inner);
    }
  }

  const msg =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error('Error:', msg);

  if (logStreamer) {
    logStreamer.sendError(msg);
    logStreamer.sendStatus('failed', msg);
  }
  handleShutdown(1);
}

/**
 * Handle graceful shutdown
 */
async function handleShutdown(exitCode = 0) {
  await cleanup();
  process.exit(exitCode);
}

/**
 * Clean up resources
 */
async function cleanup() {
  if (claudeCodeRunner) {
    claudeCodeRunner.kill();
  }

  if (logStreamer) {
    logStreamer.stopStatsReporting();
    logStreamer.disconnect();
  }

  try {
    if (fs.existsSync('/tmp/.ready')) {
      fs.unlinkSync('/tmp/.ready');
    }
  } catch (error) {
    console.error('Failed to remove ready file:', error);
  }
}

main().catch(handleError);
