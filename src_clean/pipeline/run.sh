#!/bin/bash
set -e

echo "✅ Container started"
echo "Current directory: $(pwd)"
echo "Checking Node version:"
node -v

echo "🚀 Running cleaned pipeline..."
node index.js
