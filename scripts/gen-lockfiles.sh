#!/bin/sh
# Generate standalone bun.lock files for api/ and frontend/.
#
# Why: Bun workspaces use a single root bun.lock, but each service Dockerfile
# has its own build context and needs a standalone lockfile for --frozen.
# Running `bun install` inside a service directory locally just reuses the
# root lockfile (workspace-aware) and never writes a per-service one.
#
# This script copies each package.json and bunfig.toml to a temp directory
# (no workspace parent visible), runs `bun install`, then copies the resulting
# lockfile back. bunfig.toml's minimumReleaseAge applies, so nothing younger
# than 15 days is locked.
#
# Run after any dependency change:
#   bun run lockfiles
#
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for pkg in api frontend; do
  tmp=$(mktemp -d)
  cp "$REPO_ROOT/$pkg/package.json" "$tmp/"
  # bunfig.toml carries minimumReleaseAge — without it the temp install would
  # resolve versions published minutes ago.
  cp "$REPO_ROOT/$pkg/bunfig.toml" "$tmp/"
  bun install --cwd "$tmp" --no-progress 2>&1 | tail -2
  cp "$tmp/bun.lock" "$REPO_ROOT/$pkg/bun.lock"
  rm -rf "$tmp"
  echo "✓  $pkg/bun.lock"
done
