# Parallelise Claude Code

A distributed system for running Claude Code tasks in isolated Docker containers with real-time monitoring and WebSocket streaming.

## 🚀 Overview

Parallelise Claude Code enables you to execute Claude Code tasks at scale in secure, isolated environments. The system consists of three main components that work together to provide a robust, production-ready solution for automated code tasks.

### Key Features

- **🐳 Containerized Execution**: Secure, isolated Docker containers for each task
- **📡 Real-time Streaming**: Live WebSocket connections for monitoring progress
- **⚡ Parallel Processing**: Run multiple Claude Code tasks simultaneously
- **🔒 Security**: Isolated environments with proper resource limits
- **📊 Monitoring**: Comprehensive logging and resource tracking
- **🌐 Official Compatibility**: Aligned with Claude Code GitHub Action patterns

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│      CLI        │    │  WebSocket       │    │ Docker Wrapper  │
│   Management    │◄──►│    Server        │◄──►│   Container     │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       ▼
        │                       │               ┌─────────────────┐
        │                       │               │   Claude Code   │
        │                       │               │     Binary      │
        │                       │               └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Container     │    │   Session        │    │   Git Repo      │
│   Orchestration │    │   Management     │    │   Cloning       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📦 Components

### [CLI (`packages/cli`)](./packages/cli/)
Command-line interface for managing Claude Code tasks and monitoring execution.

**Key Features:**
- Task submission and management
- Real-time log streaming
- Container orchestration
- Progress monitoring

### [WebSocket Server (`packages/websocket-server`)](./packages/websocket-server/)
Real-time communication hub for streaming logs and coordinating between components.

**Key Features:**
- WebSocket connections for live updates
- Session management
- Multi-client support
- Authentication and authorization

### [Docker Wrapper (`packages/docker-wrapper`)](./packages/docker-wrapper/)
Containerized execution environment for Claude Code tasks with Git integration.

**Key Features:**
- Secure container execution
- Git repository cloning
- Real-time output streaming
- Resource monitoring and limits

## 🚀 Quick Start

### Prerequisites

- **Docker**: For containerized execution
- **Node.js 20+**: For development and CLI usage
- **pnpm**: Package manager (recommended)

### 1. Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd parallelise-claude-code

# Install all dependencies
pnpm install

# Build all packages
pnpm build
```

### 2. Start the WebSocket Server

```bash
# Start the WebSocket server
cd packages/websocket-server
pnpm start

# Or in development mode
pnpm dev
```

The server will start on `ws://localhost:8080` by default.

### 3. Build the Docker Wrapper

```bash
# Build the Docker image
cd packages/docker-wrapper
pnpm docker:build
```

### 4. Run a Claude Code Task

```bash
# Using the CLI
cd packages/cli
pnpm build

# Run a task (example)
node dist/index.js run \
  --repo "https://github.com/your/repo.git" \
  --task "Fix the authentication bug in login.js"

# Or using Docker directly
cd packages/docker-wrapper
docker run -it --rm \
  -e REPO_URL="https://github.com/your/repo.git" \
  -e TASK="Fix the authentication bug" \
  -e WS_SERVER="ws://localhost:8080" \
  claude-code-wrapper
```

## 🔧 Configuration

### Environment Variables

#### Global Configuration
- `LOG_LEVEL`: Logging level (`debug`, `info`, `warn`, `error`)
- `NODE_ENV`: Environment (`development`, `production`)

#### WebSocket Server
- `PORT`: Server port (default: `8080`)
- `HOST`: Server host (default: `0.0.0.0`)
- `WS_PING_INTERVAL`: Ping interval in ms (default: `30000`)

#### Docker Wrapper
- `REPO_URL`: Git repository URL *(required)*
- `TASK`: Task description for Claude *(required)*
- `WS_SERVER`: WebSocket server URL *(required)*
- `GITHUB_TOKEN`: GitHub token for private repositories
- `TIMEOUT`: Task timeout in milliseconds (default: `1800000`)

#### Claude Code Options
- `ALLOWED_TOOLS`: Allowed tools for Claude
- `DISALLOWED_TOOLS`: Disallowed tools for Claude
- `MAX_TURNS`: Maximum conversation turns
- `MODEL`: Claude model to use
- `SYSTEM_PROMPT`: Custom system prompt

See individual component READMEs for complete configuration options.

## 📖 Usage Examples

### Basic Task Execution

```bash
# 1. Start WebSocket server
cd packages/websocket-server && pnpm start &

# 2. Run a simple task
cd packages/docker-wrapper
docker run --rm \
  -e REPO_URL="https://github.com/user/repo.git" \
  -e TASK="Add error handling to the API endpoints" \
  -e WS_SERVER="ws://localhost:8080" \
  claude-code-wrapper
```

### Multiple Parallel Tasks

```bash
# Run multiple tasks in parallel
for i in {1..3}; do
  docker run --rm -d \
    -e REPO_URL="https://github.com/user/repo$i.git" \
    -e TASK="Refactor the codebase for better performance" \
    -e WS_SERVER="ws://localhost:8080" \
    claude-code-wrapper
done
```

### Advanced Configuration

```bash
# Advanced task with custom Claude settings
docker run --rm \
  -e REPO_URL="https://github.com/user/enterprise-repo.git" \
  -e TASK="Implement comprehensive test coverage" \
  -e WS_SERVER="ws://localhost:8080" \
  -e GITHUB_TOKEN="$GITHUB_TOKEN" \
  -e ALLOWED_TOOLS="edit_file,run_command,read_file" \
  -e MAX_TURNS="20" \
  -e MODEL="claude-3-5-sonnet-20241022" \
  -e SYSTEM_PROMPT="You are a senior test engineer focused on comprehensive coverage" \
  claude-code-wrapper
```

## 🔍 Monitoring

### Real-time Logs via WebSocket

```bash
# Monitor logs using websocat
websocat ws://localhost:8080

# Subscribe to a specific container
{"type":"subscribe","sessionId":"container-123","auth":{"token":"your-token"}}
```

### Container Status

```bash
# Check running containers
docker ps --filter "ancestor=claude-code-wrapper"

# View container logs
docker logs <container-id>

# Monitor resource usage
docker stats
```

## 🛠️ Development

### Project Structure

```
parallelise-claude-code/
├── packages/
│   ├── cli/                 # Command-line interface
│   ├── websocket-server/    # WebSocket communication hub
│   └── docker-wrapper/      # Containerized execution environment
├── scripts/                 # Build and deployment scripts
├── k8s/                    # Kubernetes deployment configs
└── README.md               # This file
```

### Development Commands

```bash
# Install dependencies for all packages
pnpm install

# Build all packages
pnpm build

# Run tests for all packages
pnpm test

# Lint all packages
pnpm lint

# Format code
pnpm format

# Development mode for WebSocket server
cd packages/websocket-server && pnpm dev

# Development mode for Docker wrapper
cd packages/docker-wrapper && pnpm dev
```

### Creating New Components

1. **Add to workspace**: Update `pnpm-workspace.yaml`
2. **Create package**: Add `package.json` with appropriate name
3. **Add dependencies**: Reference other packages using workspace protocol
4. **Update build**: Add to root build scripts
5. **Document**: Create comprehensive README

## 🚀 Deployment

### Docker Compose

```yaml
version: '3.8'
services:
  websocket-server:
    build: ./packages/websocket-server
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info

  claude-wrapper:
    build: ./packages/docker-wrapper
    environment:
      - WS_SERVER=ws://websocket-server:8080
    depends_on:
      - websocket-server
```

### Kubernetes

See `k8s/` directory for Kubernetes deployment configurations:

- `websocket-server.yaml`: WebSocket server deployment
- `job-template.yaml`: Claude Code job template

### Production Considerations

- **Resource Limits**: Set appropriate CPU/memory limits
- **Security**: Use non-root users, read-only filesystems
- **Networking**: Configure proper network policies
- **Monitoring**: Set up logging aggregation and metrics
- **Scaling**: Use horizontal pod autoscaling for WebSocket server

## 🔒 Security

### Container Security

- **Non-root execution**: All containers run as non-privileged users
- **Read-only root filesystem**: Prevents runtime modifications
- **Resource limits**: CPU and memory constraints
- **Network isolation**: Restricted network access

### Access Control

- **Token-based authentication**: WebSocket connections require valid tokens
- **Repository access**: Support for private repositories via tokens
- **Environment isolation**: Each task runs in isolated environment

### Best Practices

- Use dedicated service accounts for repository access
- Regularly update base images and dependencies
- Monitor container behavior and resource usage
- Implement proper secret management

## 📋 API Reference

### WebSocket Protocol

See [WebSocket Server README](./packages/websocket-server/README.md) for complete API documentation.

### Environment Variables

See individual component READMEs for complete environment variable references:
- [CLI Environment Variables](./packages/cli/README.md)
- [WebSocket Server Configuration](./packages/websocket-server/README.md)
- [Docker Wrapper Configuration](./packages/docker-wrapper/README.md)

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Follow the existing code style
4. **Add tests**: Ensure your changes are tested
5. **Update documentation**: Update READMEs and comments
6. **Submit a pull request**: Describe your changes clearly

### Development Setup

```bash
# Fork and clone
git clone https://github.com/your-username/parallelise-claude-code.git
cd parallelise-claude-code

# Install dependencies
pnpm install

# Set up pre-commit hooks
pnpm husky install

# Run tests
pnpm test

# Start development servers
pnpm dev
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check component-specific READMEs
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join GitHub Discussions for questions
- **Contributing**: See CONTRIBUTING.md for guidelines

## 🔄 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

---

**Built with ❤️ for the Claude Code community**