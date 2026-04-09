#!/usr/bin/env bash
# protect-master.sh — apply branch protection rules to master
#
# Usage:
#   ./scripts/protect-master.sh
#   ./scripts/protect-master.sh --repo owner/viktorani
#   ./scripts/protect-master.sh --dry-run

set -euo pipefail

REPO="${REPO:-}"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)     REPO="${2:?'--repo requires owner/name'}"; shift 2 ;;
    --dry-run)  DRY_RUN=1; shift ;;
    -h|--help)
      echo "Usage: $0 [--repo owner/repo] [--dry-run]"
      exit 0 ;;
    *) echo "Unknown flag: $1"; exit 2 ;;
  esac
done

# Resolve repo from git remote if not provided
if [[ -z "$REPO" ]]; then
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null) || {
    echo "Error: could not determine repo — pass --repo owner/name or run from inside the repo"
    exit 1
  }
fi

echo "Repo:   $REPO"
echo "Branch: master"
echo ""

PAYLOAD=$(cat <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["CI / ci", "PR Title / lint-title"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false
}
JSON
)

if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry run — would apply:"
  echo "$PAYLOAD" | python3 -m json.tool
  exit 0
fi

gh api \
  "repos/${REPO}/branches/master/protection" \
  --method PUT \
  --input - <<< "$PAYLOAD"

echo ""
echo "✓ Branch protection applied to master"
echo ""
echo "Required status checks:"
echo "  - 'CI / ci'             — typecheck, lint, test, build"
echo "  - 'PR Title / lint-title' — conventional commit title format"
echo "  - Branch must be up to date before merge"
echo "  - Force pushes blocked"
echo "  - Deletion blocked"
