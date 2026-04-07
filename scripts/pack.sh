#!/usr/bin/env bash
# pack.sh — build a release tarball of the viktorani project
#
# Usage:
#   ./scripts/pack.sh                    # outputs viktorani.tar.gz in repo root
#   ./scripts/pack.sh -o ~/Desktop       # output to a specific directory
#   ./scripts/pack.sh -n --quiet         # dry-run, no output
#   ./scripts/pack.sh --help

set -euo pipefail

# ── helpers ───────────────────────────────────────────────────────────────────

PROG=$(basename "$0")
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

_use_color() {
  [[ -z "${NO_COLOR-}" ]] && [[ "${TERM-}" != "dumb" ]] && [[ -t 2 ]]
}

err()  {
  if _use_color; then printf '\033[31mError:\033[0m %s\n' "$*" >&2
  else printf 'Error: %s\n' "$*" >&2; fi
}

info() {
  [[ "${QUIET:-0}" == "1" ]] && return
  printf '%s\n' "$*" >&2
}

ok() {
  [[ "${QUIET:-0}" == "1" ]] && return
  if _use_color; then printf '\033[32m✓\033[0m %s\n' "$*" >&2
  else printf '✓ %s\n' "$*" >&2; fi
}

usage() {
  cat >&2 <<EOF
USAGE
  $PROG [flags]

DESCRIPTION
  Build a release tarball of the viktorani project, excluding
  node_modules, dist, and other dev artifacts.

EXAMPLES
  $PROG                       # create viktorani.tar.gz in repo root
  $PROG -o ~/Desktop          # write to a specific directory
  $PROG --name my-release     # custom archive name (no .tar.gz needed)
  $PROG -n                    # dry-run: show what would be included

FLAGS
  -o, --output DIR    Directory to write the archive (default: repo root)
  -N, --name NAME     Archive base name without extension (default: viktorani)
  -n, --dry-run       List files that would be included; don't write anything
  -q, --quiet         Suppress non-essential output
  --no-color          Disable colour output
  -h, --help          Show this help

EOF
}

# ── defaults ──────────────────────────────────────────────────────────────────

OUTPUT_DIR="$REPO_ROOT/dist"
ARCHIVE_NAME="viktorani"
DRY_RUN=0
QUIET=0

# ── arg parsing ───────────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output)    OUTPUT_DIR="${2:?'--output requires a DIR'}"; shift 2 ;;
    -N|--name)      ARCHIVE_NAME="${2:?'--name requires a NAME'}"; shift 2 ;;
    -n|--dry-run)   DRY_RUN=1; shift ;;
    -q|--quiet)     QUIET=1; shift ;;
    --no-color)     NO_COLOR=1; export NO_COLOR; shift ;;
    -h|--help)      usage; exit 0 ;;
    *)              err "unknown flag: $1"; usage; exit 2 ;;
  esac
done

# ── validate ──────────────────────────────────────────────────────────────────

if [[ ! -d "$OUTPUT_DIR" ]]; then
  err "output directory does not exist: $OUTPUT_DIR"
  exit 1
fi

ARCHIVE="${OUTPUT_DIR%/}/${ARCHIVE_NAME}.tar.gz"

# ── excludes ─────────────────────────────────────────────────────────────────
# Keep this list minimal — pack everything that belongs in the repo.

EXCLUDES=(
  --exclude='.git'
  --exclude='node_modules'
  --exclude='dist'
  --exclude='.vite'
  --exclude='coverage'
  --exclude='*.tar.gz'
  --exclude='.DS_Store'
  --exclude='*.local'
)

# ── dry-run ───────────────────────────────────────────────────────────────────

if [[ "$DRY_RUN" == "1" ]]; then
  info "Dry run — files that would be included:"
  tar "${EXCLUDES[@]}" -cz --to-stdout -C "$(dirname "$REPO_ROOT")" \
    "$(basename "$REPO_ROOT")" 2>/dev/null \
    | tar -tz 2>/dev/null \
    | sed 's|^[^/]*/||' \
    | grep -v '^$'
  info ""
  info "Archive would be written to: $ARCHIVE"
  exit 0
fi

# ── build ─────────────────────────────────────────────────────────────────────

info "Packing $(basename "$REPO_ROOT") → $ARCHIVE …"

tar "${EXCLUDES[@]}" \
  -czf "$ARCHIVE" \
  -C "$(dirname "$REPO_ROOT")" \
  "$(basename "$REPO_ROOT")"

SIZE=$(du -sh "$ARCHIVE" | cut -f1)
ok "Done — $ARCHIVE ($SIZE)"
