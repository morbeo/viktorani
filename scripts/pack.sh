#!/usr/bin/env bash
# scripts/pack.sh — produce a source-only tarball for AI analysis.
# Excludes binaries, generated files, and anything an AI cannot read.
# Output: viktorani-<version>.tgz in the repo root.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('./package.json').version")"
OUT="$ROOT/archives/viktorani-${VERSION}.tgz"

# Files and dirs to exclude (binaries, generated, irrelevant to source analysis)
EXCLUDES=(
  --exclude='.git'
  --exclude='node_modules'
  --exclude='dist'
  --exclude='coverage'
  --exclude='*.png'
  --exclude='*.ico'
  --exclude='*.svg'
  --exclude='*.webp'
  --exclude='*.jpg'
  --exclude='*.jpeg'
  --exclude='*.woff2'
  --exclude='*.woff'
  --exclude='CHANGELOG.md'
  --exclude='LICENSE'
  --exclude='src/assets'
  --exclude='public'
  --exclude='deploy'
  --exclude='archives'
)

cd "$ROOT"
tar -czf "$OUT" "${EXCLUDES[@]}" .
du -sh "$OUT"
