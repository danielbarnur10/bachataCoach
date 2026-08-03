#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_NAME="$(basename "$REPO_ROOT")"
WORKTREE_BASE="${WORKTREE_BASE:-$(cd "$REPO_ROOT/.." && pwd)/${REPO_NAME}.worktrees}"

show_help() {
  cat <<'EOF'
Usage:
  ./scripts/worktrees-integrate.sh --status
  ./scripts/worktrees-integrate.sh --repair
  ./scripts/worktrees-integrate.sh --exec "<command>"

Options:
  --status         Show discovered worktrees and git worktree list output.
  --repair         Repair moved worktree metadata for discovered worktrees.
  --exec CMD       Run CMD in main repo and each discovered worktree.
  --help           Show this help.

Environment:
  WORKTREE_BASE    Override default sibling folder for worktrees.
EOF
}

discover_worktrees() {
  if [[ ! -d "$WORKTREE_BASE" ]]; then
    return 0
  fi

  while IFS= read -r -d '' gitfile; do
    local wt_root
    wt_root="$(dirname "$gitfile")"
    if grep -q "/.git/worktrees/" "$gitfile"; then
      WORKTREES+=("$wt_root")
    fi
  done < <(find "$WORKTREE_BASE" -type f -name .git -print0)
}

run_status() {
  echo "Repository root: $REPO_ROOT"
  echo "Worktree base: $WORKTREE_BASE"
  echo "Discovered worktrees: ${#WORKTREES[@]}"
  for wt in "${WORKTREES[@]}"; do
    echo "- $wt"
  done
  echo
  (cd "$REPO_ROOT" && git worktree list)
}

run_repair() {
  if [[ ${#WORKTREES[@]} -eq 0 ]]; then
    echo "No worktrees discovered under $WORKTREE_BASE"
    return 0
  fi

  echo "Repairing git metadata for discovered worktrees..."
  (cd "$REPO_ROOT" && git worktree repair "${WORKTREES[@]}")
  echo
  (cd "$REPO_ROOT" && git worktree list)
}

run_exec() {
  local cmd="$1"
  local all_roots=("$REPO_ROOT")
  all_roots+=("${WORKTREES[@]}")

  for root in "${all_roots[@]}"; do
    echo
    echo "=== $root ==="
    (cd "$root" && eval "$cmd")
  done
}

ACTION=""
EXEC_CMD=""
WORKTREES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --status)
      ACTION="status"
      ;;
    --repair)
      ACTION="repair"
      ;;
    --exec)
      ACTION="exec"
      shift
      EXEC_CMD="${1:-}"
      ;;
    --help|-h)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
  shift
done

if [[ -z "$ACTION" ]]; then
  show_help
  exit 1
fi

if [[ "$ACTION" == "exec" && -z "$EXEC_CMD" ]]; then
  echo "Missing command for --exec"
  exit 1
fi

discover_worktrees

case "$ACTION" in
  status)
    run_status
    ;;
  repair)
    run_repair
    ;;
  exec)
    run_exec "$EXEC_CMD"
    ;;
esac
