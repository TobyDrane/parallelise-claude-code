# Parallelise Claude Code

Run Claude Code tasks in isolated Docker containers with real-time monitoring.

## Quick Start

### 1. Start the WebSocket Server

```bash
cd packages/websocket-server
pnpm install && pnpm build
pnpm start
```

The server runs on `ws://localhost:8080`

### 2. Build the Docker Wrapper

```bash
cd packages/docker-wrapper
pnpm run docker:build
```

### 3. Run a Task

```bash
docker run --rm \
  -e REPO_URL="https://github.com/your/repo.git" \
  -e TASK="Fix the authentication bug in login.js" \
  -e WS_SERVER="ws://localhost:8080" \
  claude-code-wrapper
```

## How It Works

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    User     │    │   WebSocket     │    │ Docker Wrapper  │
│  (Docker)   │◄──►│    Server       │◄──►│   Container     │
│             │    │                 │    │                 │
└─────────────┘    └─────────────────┘    └─────────────────┘
                           │                        │
                           │                        ▼
                           │                ┌─────────────────┐
                           │                │   Claude Code   │
                           │                │     Binary      │
                           │                └─────────────────┘
                           │                        │
                           ▼                        ▼
                   ┌─────────────────┐      ┌─────────────────┐
                   │   Real-time     │      │   Git Repo      │
                   │   Monitoring    │      │   Cloning       │
                   └─────────────────┘      └─────────────────┘
```

1. **WebSocket Server** handles real-time communication
2. **Docker Wrapper** runs Claude Code in isolated containers
3. **Git Integration** automatically clones repositories
4. **Live Streaming** shows progress and output in real-time

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REPO_URL` | ✅ | Git repository URL |
| `TASK` | ✅ | Task description for Claude |
| `WS_SERVER` | ✅ | WebSocket server URL |
| `GITHUB_TOKEN` | | Token for private repositories |

## Development

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Start WebSocket server in dev mode
cd packages/websocket-server && pnpm dev

# Start Docker wrapper in dev mode
cd packages/docker-wrapper && pnpm dev
```

## Project Structure

```
packages/
├── websocket-server/    # Real-time communication hub
└── docker-wrapper/      # Containerized Claude Code execution
```

## Requirements

- Docker
- Node.js 20+
- pnpm

---

For detailed documentation, see the README files in each package directory.