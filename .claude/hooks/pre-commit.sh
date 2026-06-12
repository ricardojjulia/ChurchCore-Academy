#!/usr/bin/env bash
# ChurchCore Academy — pre-commit safety gate
# Blocks commits that would include sensitive files or credential patterns.

set -euo pipefail

# 1. Block sensitive file extensions
if git diff --cached --name-only \
   | grep -qE '\.(pem|key|p12|pfx)$|secrets\.json|\.env(?!\.example)'; then
  echo "BLOCKED: attempt to commit sensitive credential files."
  echo "Remove the file from the commit or add it to .gitignore."
  exit 1
fi

# 2. Block obvious secret patterns in staged content
if git diff --cached | grep -qE \
   'accessToken\s*=\s*["\x27][^"\x27]{8,}|clientSecret\s*=\s*["\x27][^"\x27]{8,}|password\s*=\s*["\x27][^"\x27]{6,}'; then
  echo "BLOCKED: staged diff appears to contain a hardcoded secret value."
  echo "Use environment variables instead."
  exit 1
fi

echo "pre-commit: no sensitive files detected."
exit 0
