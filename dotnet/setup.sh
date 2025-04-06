#!/bin/bash
# Setup script for .NET Standards

echo ""
echo "Setting up .NET coding-standards within project..."
SCRIPT_PATH="${BASH_SOURCE[0]}"

echo "Determining setup script location..."
SCRIPT_DIR="$(cd "$(dirname $SCRIPT_PATH)" && pwd)"
echo "Setup script Directory: $SCRIPT_DIR"

echo "Calculating project root directory..."
PROJECT_DIR="$(cd "$(dirname "$(dirname "$SCRIPT_DIR")")" && pwd)"
echo "Project root directory: $PROJECT_DIR"

echo ""
echo "Setting up .editorconfig symlink to project root..."
ln -sf "$SCRIPT_DIR/editorconfig/.editorconfig" "$PROJECT_DIR/.editorconfig"

echo ""
echo "Setting up Directory.Build.props symlink to project root..."
ln -sf "$SCRIPT_DIR/directory-build-props/Directory.Build.props" "$PROJECT_DIR/Directory.Build.props"

echo ""
echo "Making git hooks setup script executable..."
sudo chmod +x "$SCRIPT_DIR/git-hooks/setup-hooks.sh"

echo "Running Git hooks setup script..."
"$SCRIPT_DIR/git-hooks/setup-hooks.sh"

echo ""
echo "attempting to create .github/workflows directory..."
mkdir -p "$PROJECT_DIR/.github/workflows"

echo "checking for existing .github/workflows/pipeline.yml file..."
if [ ! -f "$PROJECT_DIR/.github/workflows/pipeline.yml" ]; then
    echo "Creating GitHub workflow from example template"
    cp "$SCRIPT_DIR/workflows/pipeline.yml.example" "$PROJECT_DIR/.github/workflows/pipeline.yml"
else
    echo "GitHub workflow (.github/workflows/pipeline.yml) already exists, aborting copy operation"
fi
