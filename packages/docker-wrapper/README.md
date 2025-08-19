# Docker Wrapper

Containerized execution environment for Claude Code tasks with Git integration and real-time streaming.

## Quick Start

### Build the Container

```bash
pnpm run docker:build
```

### Run a Task

```bash
docker run --rm \
  -e REPO_URL="https://github.com/your/repo.git" \
  -e TASK="Add error handling to the API" \
  -e WS_SERVER="ws://localhost:8080" \
  claude-code-wrapper
```

## Environment Variables

### Required
- `REPO_URL` - Git repository URL
- `TASK` - Task description for Claude
- `WS_SERVER` - WebSocket server URL (e.g., `ws://localhost:8080`)

### Optional
- `GITHUB_TOKEN` - For private repositories
- `TIMEOUT` - Task timeout in milliseconds (default: 30 minutes)
- `LOG_LEVEL` - Logging level (`debug`, `info`, `warn`, `error`)
- `WORKSPACE_DIR` - Working directory (default: `/workspace`)

### Claude Code Options
- `ALLOWED_TOOLS` - Comma-separated list of allowed tools
- `DISALLOWED_TOOLS` - Comma-separated list of disallowed tools  
- `MAX_TURNS` - Maximum conversation turns
- `MODEL` - Claude model to use (default: `claude-4-sonnet`)
- `SYSTEM_PROMPT` - Custom system prompt

## Example with Private Repository

```bash
docker run --rm \
  -e REPO_URL="https://github.com/private/repo.git" \
  -e TASK="Refactor the authentication system" \
  -e WS_SERVER="ws://localhost:8080" \
  -e GITHUB_TOKEN="ghp_xxxxxxxxxxxx" \
  -e ALLOWED_TOOLS="edit_file,run_command,read_file" \
  -e MAX_TURNS="15" \
  claude-code-wrapper
```

## Development

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Run in development mode
pnpm dev

# Build Docker image
pnpm run docker:build
```

## Features

- **Secure Execution** - Runs as non-root user in isolated container
- **Git Integration** - Automatic repository cloning with progress tracking
- **Real-time Streaming** - Live output via WebSocket connection
- **Resource Monitoring** - CPU and memory usage tracking
- **Error Handling** - Comprehensive error reporting and recovery

## Architecture

The wrapper coordinates several components:
- **ClaudeCodeRunner** - Executes Claude Code binary
- **GitManager** - Handles repository operations
- **LogStreamer** - Streams output to WebSocket server
- **WebSocketClient** - Manages real-time communication