#!/bin/bash
# Pre-commit hook to format .NET code

echo ""
echo "Running C# pre-commit hook"
echo "Getting all staged .cs files..."
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.cs$')

if [ -z "$STAGED_FILES" ]; then
  echo "No C# files to format."
  exit 0
fi

echo ""
echo "Stashing any unstaged changes..."
git stash -q --keep-index

echo ""
echo "Running dotnet format on staged .cs files..."
echo "Attempting to format the following files:"
echo "$STAGED_FILES"

echo ""
echo "Formatting..."
dotnet format --include "$STAGED_FILES" --verbosity normal

# Store the format return code
FORMAT_EXIT_CODE=$?

echo ""
if [ $FORMAT_EXIT_CODE -eq 0 ]; then
  echo "Format successful, re-adding the formatted files to the staging area"
  git add $STAGED_FILES
else
  echo "dotnet format failed with exit code $FORMAT_EXIT_CODE"
fi

echo ""
echo "Unstashing any unstaged changes..."
git stash pop -q

# Return the format command exit code
exit $FORMAT_EXIT_CODE
