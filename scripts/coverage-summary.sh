#!/usr/bin/env bash
# coverage-summary.sh
#
# Reads coverage/coverage-summary.json produced by vitest --coverage and
# writes a markdown summary to GITHUB_STEP_SUMMARY (CI) or stdout (local).
#
# Usage:
#   bash scripts/coverage-summary.sh
#   bash scripts/coverage-summary.sh --input path/to/coverage-summary.json

set -euo pipefail

INPUT="coverage/coverage-summary.json"

while [[ $# -gt 0 ]]; do
  case $1 in
    --input|-i) INPUT="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ ! -f "$INPUT" ]]; then
  echo "Error: coverage summary not found at $INPUT" >&2
  echo 'Run "npm run test:coverage" first.' >&2
  exit 1
fi

# Thresholds must match vite.config.ts coverage.thresholds
WARN_STMTS=80; WARN_BRANCH=75; WARN_FUNCS=80; WARN_LINES=80

badge() {
  local pct=$1 warn=$2
  if (( $(echo "$pct >= $warn" | bc -l) )); then echo '✅'
  elif (( $(echo "$pct >= $warn - 10" | bc -l) )); then echo '⚠️'
  else echo '❌'
  fi
}

fmt() { echo "${1}% (${2}/${3})"; }

json=$(cat "$INPUT")

stmts_pct=$(echo "$json"  | jq -r '.total.statements.pct')
stmts_cov=$(echo "$json"  | jq -r '.total.statements.covered')
stmts_tot=$(echo "$json"  | jq -r '.total.statements.total')
branch_pct=$(echo "$json" | jq -r '.total.branches.pct')
branch_cov=$(echo "$json" | jq -r '.total.branches.covered')
branch_tot=$(echo "$json" | jq -r '.total.branches.total')
funcs_pct=$(echo "$json"  | jq -r '.total.functions.pct')
funcs_cov=$(echo "$json"  | jq -r '.total.functions.covered')
funcs_tot=$(echo "$json"  | jq -r '.total.functions.total')
lines_pct=$(echo "$json"  | jq -r '.total.lines.pct')
lines_cov=$(echo "$json"  | jq -r '.total.lines.covered')
lines_tot=$(echo "$json"  | jq -r '.total.lines.total')

md="## Coverage Report

| Metric | Coverage | Status |
|--------|----------|--------|
| Statements | $(fmt "$stmts_pct"  "$stmts_cov"  "$stmts_tot")  | $(badge "$stmts_pct"  $WARN_STMTS) |
| Branches   | $(fmt "$branch_pct" "$branch_cov" "$branch_tot") | $(badge "$branch_pct" $WARN_BRANCH) |
| Functions  | $(fmt "$funcs_pct"  "$funcs_cov"  "$funcs_tot")  | $(badge "$funcs_pct"  $WARN_FUNCS) |
| Lines      | $(fmt "$lines_pct"  "$lines_cov"  "$lines_tot")  | $(badge "$lines_pct"  $WARN_LINES) |

<details><summary>Per-file breakdown</summary>

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
$(echo "$json" | jq -r --arg root "$(readlink -f $PWD)/" '
  to_entries
  | map(select(.key != "total"))
  | sort_by(.key)
  | .[]
  | "| `\(.key | ltrimstr($root))` | \(.value.statements.pct)% | \(.value.branches.pct)% | \(.value.functions.pct)% | \(.value.lines.pct)% |"
')

</details>
"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  echo "$md" >> "$GITHUB_STEP_SUMMARY"
  echo "Coverage summary written to job summary."
else
  echo "$md"
fi
