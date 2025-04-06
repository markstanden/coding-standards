#!/bin/bash
# Setup script for .NET Standards

# Determine the directory of this script
SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname $SCRIPT_PATH)" && pwd)"

# Assume project directory is parent of the coding-standards repository
PROJECT_DIR="$(cd "$(dirname "$(dirname "$SCRIPT_DIR")")" && pwd)"

echo "Setting up .NET standards..."
echo "Setup script Directory: $SCRIPT_DIR"
echo "Project Dir: $PROJECT_DIR"

# 1. Set up .editorconfig with symlink
echo "Setting up .editorconfig..."
ln -sf "$SCRIPT_DIR/editorconfig/.editorconfig" "$PROJECT_DIR/.editorconfig"

# 2. Set up Directory.Build.props with symlink
echo "Setting up Directory.Build.props..."
ln -sf "$SCRIPT_DIR/directory-build-props/Directory.Build.props" "$PROJECT_DIR/Directory.Build.props"

# 3. Set up Git hooks
echo "Setting up Git hooks..."
sudo chmod +x "$SCRIPT_DIR/git-hooks/setup-hooks.sh"
"$SCRIPT_DIR/git-hooks/setup-hooks.sh"

# 4. create .github/workflows directory
echo "Setting up GitHub workflows..."
mkdir -p "$PROJECT_DIR/.github/workflows"

# Copy the pipeline workflow file if it doesn't already exist, backup existing if it does.
if [ -f "$PROJECT_DIR/.github/workflows/pipeline.yml" ]; then
    echo "GitHub workflow already exists: $PROJECT_DIR/.github/workflows/pipeline.yml"
    echo "Backing up existing: $PROJECT_DIR/.github/workflows/~pipeline.yml"
    cp "$PROJECT_DIR/.github/workflows/pipeline.yml" "$PROJECT_DIR/.github/workflows/~pipeline.yml"
fi

cp "$SCRIPT_DIR/workflows/pipeline.yml" "$PROJECT_DIR/.github/workflows/pipeline.yml"
echo "Created GitHub workflow: $PROJECT_DIR/.github/workflows/pipeline.yml"

echo "Setup complete!"
echo "The following standards have been applied:"
echo "  - .editorconfig for code formatting"
echo "  - Directory.Build.props for common build properties"
echo "  - Git hooks for pre-commit formatting"
echo "  - GitHub workflow for CI/CD pipeline"