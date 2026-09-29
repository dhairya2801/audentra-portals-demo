#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p artifacts/ui-refresh
base=a749ff1725291c4f90d8d9c70638563ff9cedc76
git ls-tree -r --name-only "$base" > artifacts/ui-refresh/base-files.txt
git diff --name-only "$base" > artifacts/ui-refresh/changed-files.txt
git show "$base:apps/web/app/staff/student360-summary.module.css" > artifacts/ui-refresh/original-student360.css
git show "$base:apps/web/app/staff/morning-brew/cards.tsx" > artifacts/ui-refresh/original-brew-cards.tsx
node tools/ui-refresh/source-integrity.mjs
