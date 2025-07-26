#!/bin/bash
set -e

echo "🚀 Initializing Claude Code Docker project..."

# Create directory structure
mkdir -p packages/{websocket-server,cli,docker-wrapper}/src
mkdir -p k8s scripts .github/workflows

# Create workspace files
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'packages/*'
EOF

# Initialize packages
for pkg in websocket-server cli docker-wrapper; do
  cd packages/$pkg
  pnpm init
  cd ../..
done

echo "✅ Project structure created!"
echo "📦 Run 'pnpm install' to install dependencies" 