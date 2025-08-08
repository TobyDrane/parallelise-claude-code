#!/bin/sh

# Check if the Node.js process is running
if pgrep -x "node" > /dev/null; then
  # Check if the application is responsive
  if [ -e "/app/.ready" ] || [ -e "/tmp/.ready" ]; then
    echo "Service is healthy"
    exit 0
  else
    echo "Service is starting"
    exit 0
  fi
else
  echo "Service is not running"
  exit 1
fi 