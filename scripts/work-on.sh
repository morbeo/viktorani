#!/usr/bin/env bash
set -euo pipefail
shopt -s extglob


SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(pwd)}"
ARCHIVES_DIR="$REPO_ROOT/archives"

if [[ $1 =~ '--clear' ]]; then
  rm -rf $ARCHIVES_DIR/*
  shift
fi

for i in $@; do
  gh issue view $i >> $ARCHIVES_DIR/issue-$i && echo "$ARCHIVES_DIR/issue-$i" &
done
wait
npm run pack
open $ARCHIVES_DIR/
