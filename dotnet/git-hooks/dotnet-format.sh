#!/bin/bash
# Pre-commit hook to format .NET code

# Get all staged .cs files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.cs$')

if [ -z "$STAGED_FILES" ]; then
  # No C# files to format, exit successfully
  exit 0
fi

echo "Running dotnet format on staged C# files..."

# Stash any unstaged changes
echo "Stashing unstaged changes..."
git stash -q --keep-index

# Format the files
echo "Formatting files:"
echo "$STAGED_FILES"
dotnet format --include "$STAGED_FILES" --verbosity normal

# Return code
FORMAT_EXIT_CODE=$?

# Re-add the formatted files to the staging area
if [ $FORMAT_EXIT_CODE -eq 0 ]; then
  echo "Adding formatted files back to staging area..."
  git add $STAGED_FILES
else
  echo "dotnet format failed with exit code $FORMAT_EXIT_CODE"
fi

# Restore the stashed changes
echo "Restoring stashed changes..."
git stash pop -q

# Return the format command exit code
exit $FORMAT_EXIT_CODE