#!/usr/bin/env bash
set -euo pipefail

spec_path="${1:?usage: verify.sh <spec-path>}"

python3 scripts/agent/verify_diff.py --spec "$spec_path"

git diff --check HEAD --

mapfile -t changed < <(
  {
    git diff --name-only HEAD --
    git ls-files --others --exclude-standard
  } | awk 'NF' | sort -u
)

for path in "${changed[@]}"; do
  case "$path" in
    *.py)
      python3 -m py_compile "$path"
      ;;
    *.js|*.mjs|*.cjs)
      if ! command -v node >/dev/null 2>&1; then
        echo "node is required to syntax-check changed JavaScript: $path" >&2
        exit 1
      fi
      node --check "$path"
      ;;
  esac
done

if printf '%s\n' "${changed[@]}" | grep -Eq '^(components/cms-actor/|components/README\.md$)'; then
  node --test components/cms-actor/test/avatar-model.test.mjs
fi

if printf '%s\n' "${changed[@]}" | grep -Eq '^(scripts/wz_fsdb/|tests/wz_fsdb/)'; then
  python3 -m unittest discover -s tests/wz_fsdb -v
fi

echo "deterministic verification passed"
