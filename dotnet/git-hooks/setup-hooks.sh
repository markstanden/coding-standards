#!/bin/bash
# Script to install Git hooks for .NET projects

echo ""
echo "Setting up git hooks within project..."
SCRIPT_PATH="${BASH_SOURCE[0]}"

echo "Determining hooks install script location..."
SCRIPT_DIR="$(cd "$(dirname $SCRIPT_PATH)" && pwd)"
echo "Hooks install script Directory: $SCRIPT_DIR"

echo "Calculating git hooks directory..."
GIT_HOOKS_DIR="$(git rev-parse --git-dir)/hooks"
echo "Git hooks directory: $GIT_HOOKS_DIR"

echo "Verifying it is in a git repository..."
if [ ! -d "$GIT_HOOKS_DIR" ]; then
  echo "Error: Not in a git repository or git hooks directory not found"
  exit 1
fi

echo ""
echo "Installing .NET pre-commit hook..."

echo "Copying the pre-commit hook..."
cp "$SCRIPT_DIR/pre-commit/dotnet-format.sh" "$GIT_HOOKS_DIR/pre-commit"

echo "Making the pre-commit hook executable..."
chmod +x "$GIT_HOOKS_DIR/pre-commit"

echo ""
echo "Verifying installation..."
if [ -x "$GIT_HOOKS_DIR/pre-commit" ]; then
  echo ".NET pre-commit hook installed successfully!"
  echo "C# files will be automatically formatted when you commit."
else
  echo "Hook installation failed. Please check permissions and try again."
  exit 1
fi
