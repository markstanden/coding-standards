#!/bin/bash
# Script to install Git hooks for .NET projects

# Determine the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Get the git hooks directory
GIT_HOOKS_DIR="$(git rev-parse --git-dir)/hooks"

# Verify we're in a git repository
if [ ! -d "$GIT_HOOKS_DIR" ]; then
  echo "Error: Not in a git repository or git hooks directory not found"
  exit 1
fi

echo "Installing .NET pre-commit hook..."

# Copy the pre-commit hook
cp "$SCRIPT_DIR/pre-commit/dotnet-format.sh" "$GIT_HOOKS_DIR/pre-commit"

# Make it executable
sudo chmod +x "$GIT_HOOKS_DIR/pre-commit"

# Verify installation
if [ -x "$GIT_HOOKS_DIR/pre-commit" ]; then
  echo ".NET pre-commit hook installed successfully!"
  echo "   C# files will be automatically formatted when you commit."
else
  echo "Hook installation failed. Please check permissions and try again."
  exit 1
fi