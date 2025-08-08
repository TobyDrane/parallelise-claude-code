# Parallelise Claude Code - WebSocket Server

A real-time WebSocket server for streaming logs from Claude Code Docker containers in the Parallelise Claude Code system.

## Overview

This WebSocket server provides real-time log streaming capabilities for the Claude Code Docker project. It enables clients to receive live logs from Docker containers running Claude Code sessions, allowing for better monitoring and debugging experiences.

## Features

- **Real-time log streaming** via WebSocket connections
- **Session management** for multiple concurrent Claude Code sessions  
- **Connection authentication** and authorization
- **Connection monitoring** and health checks
- **High performance** with minimal latency
- **Structured logging** with Pino

## Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Start the server
pnpm start
```

## Development

```bash
# Start in development mode with hot reload
pnpm dev
```

## Configuration

Configure the server using environment variables:

```env
# Server Configuration
PORT=8080
HOST=0.0.0.0

# WebSocket Configuration
WS_PING_INTERVAL=30000
WS_PING_TIMEOUT=5000

# Session Configuration
SESSION_TIMEOUT=300000
MAX_SESSIONS=100

# Logging
LOG_LEVEL=info
```

## API Reference

### WebSocket Connection

Connect to the WebSocket server:

```javascript
const ws = new WebSocket('ws://localhost:8080');
```

### Message Protocol

#### Client → Server Messages

**Subscribe to Session Logs**
```json
{
  "type": "subscribe",
  "sessionId": "session-123",
  "auth": {
    "token": "your-auth-token"
  }
}
```

**Unsubscribe from Session**
```json
{
  "type": "unsubscribe", 
  "sessionId": "session-123"
}
```

**Ping**
```json
{
  "type": "ping"
}
```

#### Server → Client Messages

**Log Stream**
```json
{
  "type": "log",
  "sessionId": "session-123",
  "timestamp": "2024-01-26T13:45:30.123Z",
  "level": "info",
  "message": "Container started successfully",
  "data": {
    "containerId": "abc123",
    "stage": "startup"
  }
}
```

**Session Status**
```json
{
  "type": "status",
  "sessionId": "session-123", 
  "status": "running|stopped|error",
  "metadata": {
    "containerId": "abc123",
    "startTime": "2024-01-26T13:45:00.000Z"
  }
}
```

**Error**
```json
{
  "type": "error",
  "code": "UNAUTHORIZED|SESSION_NOT_FOUND|INVALID_MESSAGE",
  "message": "Detailed error message",
  "sessionId": "session-123"
}
```

**Pong**
```json
{
  "type": "pong"
}
```

## Usage Examples

### Basic Client Connection

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log('Connected to WebSocket server');
  
  // Subscribe to a session
  ws.send(JSON.stringify({
    type: 'subscribe',
    sessionId: 'my-session-123',
    auth: { token: 'my-auth-token' }
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  switch (message.type) {
    case 'log':
      console.log(`[${message.sessionId}] ${message.message}`);
      break;
    case 'status':
      console.log(`Session ${message.sessionId} status: ${message.status}`);
      break;
    case 'error':
      console.error(`Error: ${message.message}`);
      break;
  }
});

ws.on('close', () => {
  console.log('Disconnected from WebSocket server');
});
```

### React Hook for Log Streaming

```typescript
import { useEffect, useState } from 'react';

interface LogEntry {
  sessionId: string;
  timestamp: string;
  level: string;
  message: string;
  data?: any;
}

export function useLogStream(sessionId: string, authToken: string) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({
        type: 'subscribe',
        sessionId,
        auth: { token: authToken }
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'log') {
        setLogs(prev => [...prev, message]);
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [sessionId, authToken]);

  return { logs, connected };
}
```

### Bash/Terminal Connection Guide

You can connect to the WebSocket server directly from the terminal using various tools:

#### Using `websocat` (Recommended)

Install websocat:
```bash
# macOS
brew install websocat

# Linux
cargo install websocat

# Or download binary from https://github.com/vi/websocat/releases
```

Connect and subscribe to a session:
```bash
# Basic connection
websocat ws://localhost:8080

# Subscribe to a session (type this after connecting)
{"type":"subscribe","sessionId":"session-123","auth":{"token":"your-token"}}

# Using echo to send messages
echo '{"type":"subscribe","sessionId":"session-123","auth":{"token":"your-token"}}' | websocat ws://localhost:8080

# Pretty print JSON responses
websocat ws://localhost:8080 | jq .

# Send ping and listen for logs
(echo '{"type":"subscribe","sessionId":"session-123","auth":{"token":"your-token"}}'; cat) | websocat ws://localhost:8080 | jq .
```

#### Using `wscat` (Node.js)

Install wscat:
```bash
npm install -g wscat
```

Connect and interact:
```bash
# Connect to server
wscat -c ws://localhost:8080

# After connection, type:
> {"type":"subscribe","sessionId":"session-123","auth":{"token":"your-token"}}

# Send ping
> {"type":"ping"}

# Unsubscribe
> {"type":"unsubscribe","sessionId":"session-123"}
```

#### Using `curl` (WebSocket upgrade)

Test WebSocket endpoint availability:
```bash
# Check if WebSocket upgrade is supported
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:8080

# Expected response should include:
# HTTP/1.1 101 Switching Protocols
# Upgrade: websocket
# Connection: Upgrade
```

#### Using a Bash Function

Create a reusable function for WebSocket testing:
```bash
# Add to ~/.bashrc or ~/.zshrc
ws_test() {
  local session_id="${1:-test-session}"
  local token="${2:-test-token}"
  local server="${3:-ws://localhost:8080}"
  
  echo "Connecting to $server with session: $session_id"
  
  (
    echo "{\"type\":\"subscribe\",\"sessionId\":\"$session_id\",\"auth\":{\"token\":\"$token\"}}"
    # Keep connection alive
    while true; do
      sleep 30
      echo '{"type":"ping"}'
    done
  ) | websocat "$server" | while read -r line; do
    echo "$(date '+%Y-%m-%d %H:%M:%S') | $line" | jq -R 'fromjson? // .'
  done
}

# Usage
ws_test "my-session-123" "my-auth-token"
ws_test "session-456" "token-789" "ws://remote-server:8080"
```

#### Automated Testing Script

```bash
#!/bin/bash
# test-websocket.sh

SERVER="ws://localhost:8080"
SESSION_ID="test-session-$(date +%s)"
AUTH_TOKEN="test-token"

echo "Testing WebSocket server at $SERVER"

# Test connection and subscription
echo '{"type":"subscribe","sessionId":"'$SESSION_ID'","auth":{"token":"'$AUTH_TOKEN'"}}' | \
  timeout 5 websocat "$SERVER" | \
  while read -r line; do
    echo "Received: $line"
    
    # Parse message type
    msg_type=$(echo "$line" | jq -r '.type // empty')
    
    case "$msg_type" in
      "log")
        echo "✓ Log message received"
        ;;
      "status")
        echo "✓ Status update received"
        ;;
      "error")
        echo "✗ Error: $(echo "$line" | jq -r '.message')"
        exit 1
        ;;
      *)
        echo "? Unknown message type: $msg_type"
        ;;
    esac
  done

echo "WebSocket test completed"
```

## Architecture

```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│   CLI Client    │◄───────────────►│ WebSocket Server│
└─────────────────┘                 └─────────────────┘
                                            │
┌─────────────────┐    WebSocket            │
│   Web Client    │◄───────────────────────►│
└─────────────────┘                         │
                                            │
┌─────────────────┐    Log Stream           │
│ Docker Container│────────────────────────►│
│  (Claude Code)  │                         │
└─────────────────┘                         │
                                            │
┌─────────────────┐    Log Stream           │
│ Docker Container│────────────────────────►│ 
│  (Claude Code)  │                         │
└─────────────────┘                         │
```

## Integration

This WebSocket server is designed to work with:

- **[@parallelise-claude-code/cli](../cli/)** - CLI tool for managing containers
- **[@parallelise-claude-code/docker-wrapper](../docker-wrapper/)** - Container wrapper that streams logs

## Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build the TypeScript project
- `pnpm start` - Start the production server
- `pnpm test` - Run tests
- `pnpm lint` - Run linting
- `pnpm format` - Format code
