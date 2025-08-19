# WebSocket Server

Real-time communication hub for streaming logs and coordinating Claude Code Docker containers.

## Quick Start

### Start the Server

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Start the server
pnpm start
```

The server will be available at `ws://localhost:8080`

### Development Mode

```bash
pnpm dev
```

## Configuration

Set environment variables to configure the server:

```bash
# Server settings
export PORT=8080
export HOST=0.0.0.0

# Authentication
export AUTH_TOKEN=your-secure-token

# Connection settings
export HEARTBEAT_INTERVAL=30000  # 30 seconds
export SESSION_TIMEOUT=300000    # 5 minutes
export MAX_SESSIONS=100

# Logging
export LOG_LEVEL=info
```

## Usage

### Connect to the Server

```javascript
const ws = new WebSocket('ws://localhost:8080?token=your-secure-token');
```

### Message Protocol

**Subscribe to container logs:**
```json
{
  "type": "subscribe",
  "containerID": "container-123",
  "auth": {
    "token": "your-auth-token"
  }
}
```

**Receive log messages:**
```json
{
  "type": "log",
  "containerID": "container-123",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "level": "info",
    "message": "Repository cloned successfully"
  }
}
```

**Status updates:**
```json
{
  "type": "status",
  "containerID": "container-123",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "status": "running",
    "message": "Executing Claude Code task"
  }
}
```

## Features

- **Real-time Streaming** - Live log and status updates
- **Session Management** - Handle multiple concurrent containers
- **Authentication** - Token-based connection security
- **Health Monitoring** - Automatic connection cleanup
- **Structured Logging** - JSON-formatted logs with Pino

## Message Types

- `log` - Log messages from containers
- `status` - Container status updates (starting, running, completed, error)
- `heartbeat` - Connection health checks
- `complete` - Task completion notifications
- `error` - Error messages and notifications

## Development

```bash
# Install dependencies
pnpm install

# Start with hot reload
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
```

## Architecture

The server manages:
- **WebSocket connections** from CLI clients and Docker containers
- **Session tracking** for active containers
- **Message routing** between containers and monitoring clients
- **Connection health** with automatic cleanup