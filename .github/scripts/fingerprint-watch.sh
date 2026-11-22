#!/usr/bin/env bash
# Searches public GitHub code for strings that only Ons uses and reports
# repositories (other than this one and its GitHub forks) that contain them.
#
# Env:
#   GITHUB_REPOSITORY  owner/name of this repo (set by Actions)
#   SEARCH_TOKEN       fine-grained PAT, public repositories read-only (search/code)
#   GH_TOKEN           token allowed to create issues in this repo
#   DRY_RUN=1          print the report instead of opening or commenting on an issue
#
# Limits: GitHub code search only sees public repositories, default branches,
# and files under 384 KB. Private copies and rewritten code stay invisible.
set -euo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
if [[ -z "${SEARCH_TOKEN:-}" ]]; then
  echo "::error::FINGERPRINT_SEARCH_TOKEN secret is not set (fine-grained PAT, public repositories read-only)"
  exit 1
fi

# The canary is also in frontend/index.html and api/src/server.ts.
CANARY="ons-fp-d4e123ec-b97c-4acb-a2c7-bed4d8eb4bf0"
TERMS=("$CANARY" "ons_applicant_session" "APPLICANT_BREAKDOWN_KEYS")
LABEL="fingerprint-hit"
TITLE="Possible copies of Ons code found"

search() { GH_TOKEN="$SEARCH_TOKEN" gh api -X GET search/code -f q="\"$1\"" -f per_page=100 \
  --jq '.items[] | [.repository.full_name, .html_url] | @tsv'; }

hits=""        # "repo<TAB>term<TAB>url" lines from other repositories
self_seen=0
for term in "${TERMS[@]}"; do
  while IFS=$'\t' read -r repo url; do
    [[ -z "$repo" ]] && continue
    if [[ "$repo" == "$GITHUB_REPOSITORY" ]]; then
      [[ "$term" == "$CANARY" ]] && self_seen=1
      continue
    fi
    hits+="${repo}"$'\t'"${term}"$'\t'"${url}"$'\n'
  done < <(search "$term")
  sleep 7 # code search allows 10 requests a minute
done

# Our own repo must match the canary, or the search isn't seeing what we think.
# (A newly added string can take a while to be indexed.)
if [[ $self_seen -eq 0 ]]; then
  echo "::warning::The canary was not found in $GITHUB_REPOSITORY itself; search may not be indexed yet or the token can't search public code."
fi

# One line per repository; GitHub forks of this repo are allowed by GitHub's terms, skip them.
report=""
for repo in $(printf '%s' "$hits" | cut -f1 | sort -u); do
  parent=$(GH_TOKEN="$SEARCH_TOKEN" gh api "repos/$repo" --jq '.parent.full_name // ""' 2>/dev/null || true)
  [[ "$parent" == "$GITHUB_REPOSITORY" ]] && continue
  terms=$(printf '%s' "$hits" | awk -F'\t' -v r="$repo" '$1==r {print "`"$2"`"}' | sort -u | paste -sd, -)
  url=$(printf '%s' "$hits" | awk -F'\t' -v r="$repo" '$1==r {print $3; exit}')
  report+="- [${repo}](https://github.com/${repo}): ${terms}, e.g. ${url}"$'\n'
done

if [[ -z "$report" ]]; then
  echo "No copies found."
  exit 0
fi

# Only report repositories not already listed in the open tracking issue.
# The list lives in the issue BODY, which only this workflow and maintainers can
# edit. Comments are ignored on purpose: anyone can comment on a public issue,
# so a copier could otherwise post "[their/repo](" to silence future reports.
issue=$(gh issue list -R "$GITHUB_REPOSITORY" --label "$LABEL" --state open --json number -q '.[0].number // ""')
known=""
if [[ -n "$issue" ]]; then
  known=$(gh issue view "$issue" -R "$GITHUB_REPOSITORY" --json body -q '.body')
fi
new=""
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  repo=$(sed -E 's/^- \[([^]]+)\].*/\1/' <<<"$line")
  grep -qF "[$repo](" <<<"$known" || new+="$line"$'\n'
done <<<"$report"

if [[ -z "$new" ]]; then
  echo "Matches found, all already reported in #$issue."
  exit 0
fi

body="These public repositories contain strings that only Ons uses:

${new}
Check each one: a copy under this repo's \"All Rights Reserved\" license can be reported with GitHub's DMCA takedown form. Close this issue once handled; new matches open a fresh one."

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  printf '%s\n' "$body"
  exit 0
fi

gh label create "$LABEL" -R "$GITHUB_REPOSITORY" --color B60205 \
  --description "Fingerprint watch found Ons code in another repository" 2>/dev/null || true
if [[ -n "$issue" ]]; then
  # Append to the body (the trusted list), then comment so watchers get notified.
  gh issue edit "$issue" -R "$GITHUB_REPOSITORY" --body "${known}
${new}"
  gh issue comment "$issue" -R "$GITHUB_REPOSITORY" --body "$body"
else
  gh issue create -R "$GITHUB_REPOSITORY" --title "$TITLE" --label "$LABEL" --body "$body"
fi
