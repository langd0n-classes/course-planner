#!/bin/bash
# gh-access-remote.sh — GitHub API access for remote/sandboxed environments
#
# Solves: gh not installed, sudo broken, wrong token var name, gh issue view GraphQL bugs
#
# Usage:
#   source scripts/gh-access-remote.sh           # install gh + set up auth
#   gh-issue <number>                             # read issue body
#   gh-issue <number> --prompt                    # read BUILD PROMPT comment
#   gh-issue <number> --comments                  # read all comments
#
# Requirements:
#   - GH_TOKEN env var set (configure in Claude Code project environment variables)

set -uo pipefail

REPO="langd0n-classes/course-planner"

# Normalize token — Claude Code uses GH_TOKEN, CI often uses GITHUB_TOKEN
if [[ -z "${GH_TOKEN:-}" ]] && [[ -n "${GITHUB_TOKEN:-}" ]]; then
  export GH_TOKEN="$GITHUB_TOKEN"
fi

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "[gh-access] ERROR: No GH_TOKEN or GITHUB_TOKEN found." >&2
  echo "[gh-access] Set GH_TOKEN in Claude Code project environment variables." >&2
  return 1 2>/dev/null || exit 1
fi

# ── Install gh without sudo (binary download) ──────────────────────
if ! command -v gh &>/dev/null; then
  echo "[gh-access] Installing gh CLI (no sudo)..." >&2
  GH_VERSION="2.67.0"
  GH_ARCHIVE="gh_${GH_VERSION}_linux_amd64.tar.gz"
  GH_URL="https://github.com/cli/cli/releases/download/v${GH_VERSION}/${GH_ARCHIVE}"

  mkdir -p ~/bin
  if curl -sL "$GH_URL" -o "/tmp/${GH_ARCHIVE}" && \
     tar -xzf "/tmp/${GH_ARCHIVE}" -C /tmp && \
     cp "/tmp/gh_${GH_VERSION}_linux_amd64/bin/gh" ~/bin/gh; then
    export PATH=~/bin:$PATH
    # Persist PATH for future Bash tool calls (each runs a new shell)
    if ! grep -q 'export PATH="$HOME/bin:$PATH"' ~/.bashrc 2>/dev/null; then
      echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
    fi
    echo "[gh-access] gh $(gh --version | head -1) installed to ~/bin/gh" >&2
  else
    echo "[gh-access] WARNING: gh binary install failed. Using curl fallback." >&2
  fi
  rm -f "/tmp/${GH_ARCHIVE}"
fi

# ── Verify auth ─────────────────────────────────────────────────────
if command -v gh &>/dev/null; then
  if gh auth status &>/dev/null 2>&1; then
    echo "[gh-access] gh authenticated." >&2
  else
    echo "[gh-access] WARNING: gh installed but auth failed. curl fallback will use GH_TOKEN directly." >&2
  fi
fi

# ── Helper function: read issues via gh api (not gh issue view) ─────
# gh issue view has a known GraphQL bug with Projects Classic.
# gh api uses the REST API and works reliably.
gh-issue() {
  local num="${1:?Usage: gh-issue <number> [--prompt|--comments|--body]}"
  local mode="${2:---body}"

  case "$mode" in
    --body|--default)
      if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
        gh api "repos/${REPO}/issues/${num}" --jq '.body'
      else
        curl -sf -H "Authorization: token ${GH_TOKEN}" \
          "https://api.github.com/repos/${REPO}/issues/${num}" | \
          python3 -c "import sys,json; print(json.load(sys.stdin).get('body',''))"
      fi
      ;;
    --prompt)
      if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
        gh api "repos/${REPO}/issues/${num}/comments" \
          --jq '[.[] | select(.body | startswith("## BUILD PROMPT"))] | last | .body'
      else
        curl -sf -H "Authorization: token ${GH_TOKEN}" \
          "https://api.github.com/repos/${REPO}/issues/${num}/comments" | \
          python3 -c "
import sys, json
comments = json.load(sys.stdin)
prompts = [c['body'] for c in comments if c.get('body','').startswith('## BUILD PROMPT')]
print(prompts[-1] if prompts else 'No BUILD PROMPT comment found.')
"
      fi
      ;;
    --comments)
      if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
        gh api "repos/${REPO}/issues/${num}/comments" \
          --jq '.[] | "---\n" + .body + "\n"'
      else
        curl -sf -H "Authorization: token ${GH_TOKEN}" \
          "https://api.github.com/repos/${REPO}/issues/${num}/comments" | \
          python3 -c "
import sys, json
for c in json.load(sys.stdin):
    print('---')
    print(c.get('body',''))
    print()
"
      fi
      ;;
    *)
      echo "Usage: gh-issue <number> [--body|--prompt|--comments]" >&2
      return 1
      ;;
  esac
}

# ── Install dependencies if needed ────────────────────────────────
if [ -f package.json ] && [ ! -d node_modules ]; then
  echo "[gh-access] Installing npm dependencies (npm ci)..." >&2
  npm ci --prefer-offline 2>&1 | tail -3 >&2
  echo "[gh-access] Dependencies installed." >&2
fi

echo "[gh-access] Ready. Use: gh-issue <number> [--body|--prompt|--comments]" >&2
