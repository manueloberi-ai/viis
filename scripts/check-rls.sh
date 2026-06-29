#!/usr/bin/env bash
# RLS regression suite
#   - rls-policy-check.sql: lightweight policy-shape guardrail (always runs)
#   - rls-tests.sql       : full role-switching behaviour tests (runs when a
#                           privileged DB connection — e.g. SUPABASE_DB_URL —
#                           is available; otherwise skipped with a warning)
#
# Exit non-zero on any failure so the build pipeline can gate on it.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HERE="$ROOT/scripts"

CONN_ARGS=()
if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  CONN_ARGS=("$SUPABASE_DB_URL")
fi

echo "▶ rls-policy-check.sql (guardrail)"
psql "${CONN_ARGS[@]}" -v ON_ERROR_STOP=1 -f "$HERE/rls-policy-check.sql"

echo
echo "▶ rls-tests.sql (full behaviour)"
if psql "${CONN_ARGS[@]}" -tAc "SELECT pg_has_role(current_user, 'authenticated', 'MEMBER')" \
   | grep -q '^t$'; then
  psql "${CONN_ARGS[@]}" -v ON_ERROR_STOP=1 -f "$HERE/rls-tests.sql"
else
  echo "  ⚠ skipped: current DB role cannot SET ROLE authenticated."
  echo "    Re-run with SUPABASE_DB_URL pointing at the project's superuser"
  echo "    connection string (CI secret) to exercise the full suite."
fi

echo
echo "✔ RLS checks complete"
