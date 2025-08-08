# Parallelise Claude Code - Docker Wrapper

A containerized wrapper for executing Claude Code tasks in isolated environments with real-time WebSocket streaming and progress monitoring.

## Overview

The Docker Wrapper provides a secure, isolated environment for running Claude Code tasks with the following features:

- **Real-time Streaming**: WebSocket connection for live output and progress updates
- **Git Integration**: Automatic repository cloning with progress tracking
- **Resource Monitoring**: CPU, memory, and execution time tracking
- **Official Compatibility**: Aligned with the official Claude Code GitHub Action implementation
- **Robust Error Handling**: Comprehensive error reporting and graceful shutdown

## Quick Start

### 1. Prerequisites

- Docker installed and running
- Node.js 20+ for development
- Access to a WebSocket server (see `../websocket-server`)

### 2. Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `REPO_URL` | ✅ | Git repository URL | `https://github.com/user/repo.git` |
| `TASK` | ✅ | Task description for Claude | `"Fix the authentication bug in login.js"` |
| `WS_SERVER` | ✅ | WebSocket server URL | `ws://localhost:8080` |
| `GITHUB_TOKEN` | | GitHub token for private repos | `ghp_xxxxxxxxxxxx` |
| `TIMEOUT` | | Timeout in milliseconds | `1800000` (30 min) |
| `LOG_LEVEL` | | Logging level | `info` |
| `WORKSPACE_DIR` | | Working directory | `/workspace` |

#### Claude Code Options

| Variable | Description | Example |
|----------|-------------|---------|
| `ALLOWED_TOOLS` | Comma-separated list of allowed tools | `edit_file,run_command` |
| `DISALLOWED_TOOLS` | Comma-separated list of disallowed tools | `web_search` |
| `MAX_TURNS` | Maximum conversation turns | `10` |
| `MCP_CONFIG` | MCP configuration file path | `/config/mcp.json` |
| `SYSTEM_PROMPT` | Custom system prompt | `"You are a senior developer"` |
| `APPEND_SYSTEM_PROMPT` | Additional system prompt | `"Focus on security"` |
| `CLAUDE_ENV` | Custom environment variables | `API_KEY: secret\nDEBUG: true` |
| `FALLBACK_MODEL` | Fallback model if primary fails | `claude-3-haiku-20240307` |
| `MODEL` | Claude model to use | `claude-3-5-sonnet-20241022` |

### 3. Build and Run

#### Option A: Using Docker directly

```bash
# Build the container
docker build -t claude-code-wrapper .

# Run with environment variables
docker run -it --rm \
  -e REPO_URL="https://github.com/your/repo.git" \
  -e TASK="Fix the bug in the authentication system" \
  -e WS_SERVER="ws://localhost:8080" \
  -e GITHUB_TOKEN="your_token_here" \
  claude-code-wrapper
```

#### Option B: Using pnpm scripts

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Build Docker image
pnpm run docker:build

# Run with environment variables set
pnpm run docker:run
```

#### Option C: Development mode

```bash
# Run in development mode (requires local setup)
pnpm run dev
```

### 4. Environment File Setup

Create a `.env` file for easier configuration:

```bash
# Required
REPO_URL=https://github.com/your/repo.git
TASK=Fix the authentication bug in login.js
WS_SERVER=ws://localhost:8080

# Optional
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
TIMEOUT=1800000
LOG_LEVEL=info
ALLOWED_TOOLS=edit_file,run_command,read_file
MAX_TURNS=15
MODEL=claude-3-5-sonnet-20241022
```

Then run:

```bash
docker run -it --rm --env-file .env claude-code-wrapper
```

## Architecture

### Component Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   WebSocket     │◄──►│  Docker Wrapper  │◄──►│   Claude Code   │
│    Server       │    │                  │    │    Binary       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Git Manager    │
                       │  (Clone Repos)   │
                       └──────────────────┘
```

### Key Components

- **ClaudeCodeRunner**: Executes Claude Code using official GitHub Action patterns
- **WebSocketClient**: Handles real-time communication with the server
- **GitManager**: Manages repository cloning and Git operations
- **LogStreamer**: Coordinates output streaming and event management
- **OutputParser**: Processes and structures Claude Code output
- **ProcessRunner**: Low-level process management utilities

### Data Flow

1. **Initialization**: Load configuration and connect to WebSocket server
2. **Repository Setup**: Clone the specified repository to workspace
3. **Claude Execution**: Run Claude Code with task using named pipes
4. **Real-time Streaming**: Stream all output, progress, and events via WebSocket
5. **Completion**: Report final status and cleanup resources

## Advanced Usage

### Custom Claude Configuration

```bash
# Advanced Claude Code configuration
docker run -it --rm \
  -e REPO_URL="https://github.com/your/repo.git" \
  -e TASK="Refactor the API endpoints" \
  -e WS_SERVER="ws://localhost:8080" \
  -e ALLOWED_TOOLS="edit_file,run_command,read_file" \
  -e DISALLOWED_TOOLS="web_search,shell" \
  -e MAX_TURNS="20" \
  -e MODEL="claude-3-5-sonnet-20241022" \
  -e SYSTEM_PROMPT="You are a senior software architect focused on clean code" \
  -e CLAUDE_ENV="API_VERSION: v2
DEBUG_MODE: true
STRICT_MODE: enabled" \
  claude-code-wrapper
```

### SSH Repository Access

```bash
# For SSH repositories, mount SSH keys
docker run -it --rm \
  -v ~/.ssh:/home/claude/.ssh:ro \
  -e REPO_URL="git@github.com:your/private-repo.git" \
  -e TASK="Update the deployment scripts" \
  -e WS_SERVER="ws://localhost:8080" \
  claude-code-wrapper
```

### Resource Limits

```bash
# Run with resource constraints
docker run -it --rm \
  --memory=2g \
  --cpus=1.0 \
  --env-file .env \
  claude-code-wrapper
```

## Development

### Project Structure

```
packages/docker-wrapper/
├── src/
│   ├── index.ts              # Main entry point
│   ├── claude-code-runner.ts # Claude Code execution
│   ├── websocket-client.ts   # WebSocket communication
│   ├── git-manager.ts        # Git operations
│   ├── log-streamer.ts       # Output coordination
│   ├── process-runner.ts     # Process management
│   ├── output-parser.ts      # Output processing
│   ├── config.ts             # Configuration management
│   └── types.ts              # TypeScript definitions
├── Dockerfile                # Container definition
├── .dockerignore            # Docker ignore rules
├── healthcheck.sh           # Container health check
└── package.json             # Dependencies and scripts
```

### Available Scripts

```bash
pnpm run build        # Compile TypeScript
pnpm run dev          # Run in development mode
pnpm run docker:build # Build Docker image
pnpm run docker:run   # Run Docker container
pnpm run test         # Run tests
```

### Building from Source

```bash
# Clone the repository
git clone <repo-url>
cd packages/docker-wrapper

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Build Docker image
pnpm run docker:build
```

## Monitoring and Debugging

### Health Checks

The container includes a health check script that monitors:
- Node.js process status
- Application readiness
- Resource utilization

### Logging

The wrapper provides structured logging at multiple levels:

```bash
# Set log level
-e LOG_LEVEL=debug    # debug, info, warn, error
```

### WebSocket Events

Monitor these events via WebSocket connection:

- `LOG`: General log messages with levels
- `STATUS`: Execution status updates
- `ERROR`: Error conditions and failures
- `HEARTBEAT`: Keep-alive and health status
- `COMPLETE`: Final execution results

### Common Issues

#### Connection Issues
```bash
# Check WebSocket server connectivity
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" \
  http://localhost:8080
```

#### Repository Access
```bash
# Test repository access
git ls-remote https://github.com/your/repo.git
```

#### Resource Issues
```bash
# Monitor container resources
docker stats <container-id>
```

## Security Considerations

- **Isolation**: All execution happens in isolated containers
- **Non-root User**: Runs as non-privileged user `claude`
- **Read-only Mounts**: Mount sensitive files as read-only
- **Network Policies**: Configure appropriate network restrictions
- **Token Security**: Use environment variables for sensitive tokens

## Performance Tuning

### Resource Allocation

```bash
# Optimize for CPU-intensive tasks
docker run --cpus=4.0 --memory=8g ...

# Optimize for memory-intensive tasks
docker run --cpus=2.0 --memory=16g ...
```

### Timeout Configuration

```bash
# Adjust timeout based on task complexity
-e TIMEOUT=3600000    # 1 hour for complex tasks
-e TIMEOUT=300000     # 5 minutes for simple tasks
```

## Integration Examples

### Kubernetes Deployment

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: claude-code-task
spec:
  template:
    spec:
      containers:
      - name: claude-wrapper
        image: claude-code-wrapper:latest
        env:
        - name: REPO_URL
          value: "https://github.com/your/repo.git"
        - name: TASK
          value: "Fix the authentication system"
        - name: WS_SERVER
          value: "ws://websocket-server:8080"
        resources:
          limits:
            memory: "4Gi"
            cpu: "2"
      restartPolicy: Never
```

### CI/CD Pipeline

```yaml
# GitHub Actions example
- name: Run Claude Code Task
  run: |
    docker run --rm \
      -e REPO_URL="${{ github.repositoryUrl }}" \
      -e TASK="Review and fix code quality issues" \
      -e WS_SERVER="${{ secrets.WS_SERVER }}" \
      -e GITHUB_TOKEN="${{ secrets.GITHUB_TOKEN }}" \
      claude-code-wrapper
```

## Support

- **Issues**: Report bugs and feature requests via GitHub Issues
- **Documentation**: Additional docs in the main repository
- **Community**: Join discussions in GitHub Discussions

## License

MIT License - see the main repository for full license details.