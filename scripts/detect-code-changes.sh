#!/usr/bin/env bash
# detect-code-changes.sh — check if any code files changed
#
# Usage:
#   detect-code-changes.sh <base-sha>   # diff HEAD vs base (CI)
#   detect-code-changes.sh --staged     # diff staged files (pre-commit)
set -euo pipefail

CODE_PATTERNS="^src/|^\.github/|vite\.config\.|tsconfig|package\.json|\.config\.ts"

if [[ "${1:-}" == "--staged" ]]; then
  CHANGED=$(git diff --cached --name-only)
else
  BASE="${1:?'Usage: detect-code-changes.sh <base-sha>'}"
  git fetch origin "$BASE" --depth=1
  CHANGED=$(git diff --name-only "$BASE" HEAD)
fi

echo "changed files:"
echo "$CHANGED"

if echo "$CHANGED" | grep --color -qE "$CODE_PATTERNS"; then
  RESULT="true"
  echo "=> code changes detected"
else
  RESULT="false"
  echo "=> no code changes"
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "code=$RESULT" >> "$GITHUB_OUTPUT"
else
  echo "code=$RESULT"
fi
