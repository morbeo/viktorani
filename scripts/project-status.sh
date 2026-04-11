#!/usr/bin/env bash
# project-status.sh — generate a project status update from git history via git-cliff
#
# Usage:
#   scripts/project-status.sh
#   scripts/project-status.sh --since v0.3.0
#   scripts/project-status.sh --since 2026-04-01 --format markdown
#   scripts/project-status.sh --unreleased --format plain | pbcopy

set -euo pipefail

# ── defaults ─────────────────────────────────────────────────────────────────

SINCE=""
UNRELEASED=false
OUTPUT="-"          # stdout
QUIET=false
NO_COLOR=false

# ── helpers ──────────────────────────────────────────────────────────────────

_color() { [[ "$NO_COLOR" == false ]] && [[ -t 2 ]] && echo true || echo false; }

err()  { local c; c=$(_color); [[ "$c" == true ]] && echo -e "\033[31mError:\033[0m $*" >&2 || echo "Error: $*" >&2; }
info() { [[ "$QUIET" == false ]] && echo "$*" >&2 || true; }

die()  { err "$@"; exit 1; }

require() {
  for cmd in "$@"; do
    command -v "$cmd" &>/dev/null || die "'$cmd' not found — install it and try again."
  done
}

usage() {
  cat >&2 <<EOF
USAGE
  $(basename "$0") [flags]

DESCRIPTION
  Generate a project status update from git history using git-cliff.
  Prints Markdown (or plain text) suitable for team updates or release notes.

EXAMPLES
  $(basename "$0")                              # unreleased commits, markdown
  $(basename "$0") --since v0.3.0              # since a tag
  $(basename "$0") --since 2026-04-01          # since a date
  $(basename "$0") --unreleased --format plain # plain text, copy-ready
  $(basename "$0") -o STATUS.md                # write to file

FLAGS
  -s, --since TAG|DATE   Show commits since this tag or ISO date (default: last tag)
      --unreleased        Show only unreleased commits (since last tag)
  -o, --output FILE       Write to file instead of stdout
  -q, --quiet             Suppress progress messages
      --no-color          Disable colour output
  -h, --help              Show this help
EOF
  exit 2
}

# ── args ─────────────────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--since)      SINCE="${2:?'--since requires a value'}"; shift 2 ;;
    --unreleased)    UNRELEASED=true; shift ;;
    -o|--output)     OUTPUT="${2:?'--output requires a value'}"; shift 2 ;;
    -q|--quiet)      QUIET=true; shift ;;
    --no-color)      NO_COLOR=true; shift ;;
    -h|--help)       usage ;;
    *)               die "unknown option: $1 (try --help)" ;;
  esac
done

# ── preflight ─────────────────────────────────────────────────────────────────

require git git-cliff

git rev-parse --git-dir &>/dev/null || die "not inside a git repository"

# ── resolve range ─────────────────────────────────────────────────────────────

CLIFF_ARGS=()

if [[ "$UNRELEASED" == true ]]; then
  CLIFF_ARGS+=(--unreleased)
  info "→ collecting unreleased commits..."

elif [[ -n "$SINCE" ]]; then
  # Determine if SINCE looks like a date (YYYY-MM-DD) or a ref
  if [[ "$SINCE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    # Convert date to the nearest commit SHA after that date
    SINCE_SHA=$(git log --after="$SINCE" --reverse --format="%H" | head -1)
    [[ -n "$SINCE_SHA" ]] || die "no commits found after $SINCE"
    CLIFF_ARGS+=(--include-path "*" -- "${SINCE_SHA}..HEAD")
    info "→ commits since $SINCE..."
  else
    # Tag or SHA
    git rev-parse --verify "$SINCE" &>/dev/null || die "ref not found: $SINCE"
    CLIFF_ARGS+=(--tag-pattern "v*" -- "${SINCE}..HEAD")
    info "→ commits since $SINCE..."
  fi

else
  # Default: unreleased (since last tag)
  CLIFF_ARGS+=(--unreleased)
  info "→ collecting unreleased commits (since last tag)..."
fi

# ── locate cliff.toml ────────────────────────────────────────────────────────

REPO_ROOT=$(git rev-parse --show-toplevel)
CLIFF_TOML="${REPO_ROOT}/cliff.toml"

[[ -f "$CLIFF_TOML" ]] || die "cliff.toml not found at $CLIFF_TOML"

# ── run ───────────────────────────────────────────────────────────────────────

info "→ running git-cliff..."

RESULT=$(git cliff --config "$CLIFF_TOML" "${CLIFF_ARGS[@]}" 2>/dev/null) || \
  die "git-cliff failed — ensure cliff.toml is valid or check 'git cliff --help'"

if [[ -z "$RESULT" ]]; then
  info "→ no commits found for the given range."
  exit 0
fi

# ── output ────────────────────────────────────────────────────────────────────

if [[ "$OUTPUT" == "-" ]]; then
  echo "$RESULT"
else
  echo "$RESULT" > "$OUTPUT"
  info "→ written to $OUTPUT"
fi
