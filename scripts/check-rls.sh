#!/usr/bin/env bash
# RLS regression suite
#   - rls-policy-check.sql: lightweight policy-shape guardrail (always runs)
#   - rls-tests.sql       : full role-switching behaviour tests (runs when a
#                           privileged DB connection — e.g. SUPABASE_DB_URL —
#                           is available; otherwise skipped with a warning)
#
# Writes a human-readable report and a policy-diff snapshot to
# scripts/.rls-report/ for CI artifact upload.
#
# Exit non-zero on any failure so the build pipeline can gate on it.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HERE="$ROOT/scripts"
OUT="$HERE/.rls-report"
mkdir -p "$OUT"

REPORT="$OUT/rls-report.txt"
POLICY_SNAPSHOT="$OUT/policies.current.tsv"
POLICY_BASELINE="$HERE/policies.baseline.tsv"
POLICY_DIFF="$OUT/policies.diff"

CONN_ARGS=()
if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  CONN_ARGS=("$SUPABASE_DB_URL")
fi

{
  echo "RLS regression report — $(date -u +%FT%TZ)"
  echo "================================================="
  echo
} > "$REPORT"

echo "▶ rls-policy-check.sql (guardrail)" | tee -a "$REPORT"
psql "${CONN_ARGS[@]}" -v ON_ERROR_STOP=1 -f "$HERE/rls-policy-check.sql" 2>&1 | tee -a "$REPORT"

echo | tee -a "$REPORT"
echo "▶ rls-tests.sql (full behaviour)" | tee -a "$REPORT"
if psql "${CONN_ARGS[@]}" -tAc "SELECT pg_has_role(current_user, 'authenticated', 'MEMBER')" \
   | grep -q '^t$'; then
  psql "${CONN_ARGS[@]}" -v ON_ERROR_STOP=1 -f "$HERE/rls-tests.sql" 2>&1 | tee -a "$REPORT"
else
  echo "  ⚠ skipped: current DB role cannot SET ROLE authenticated." | tee -a "$REPORT"
  echo "    Re-run with SUPABASE_DB_URL pointing at the project's superuser" | tee -a "$REPORT"
  echo "    connection string (CI secret) to exercise the full suite." | tee -a "$REPORT"
fi

# Snapshot current policy shape for diffing against the committed baseline.
echo | tee -a "$REPORT"
echo "▶ policy snapshot → $POLICY_SNAPSHOT" | tee -a "$REPORT"
psql "${CONN_ARGS[@]}" -At -F $'\t' -c "
  SELECT schemaname, tablename, policyname, cmd,
         array_to_string(roles,','), coalesce(qual,''), coalesce(with_check,'')
    FROM pg_policies
   WHERE schemaname = 'public'
   ORDER BY tablename, policyname;
" > "$POLICY_SNAPSHOT"

if [[ -f "$POLICY_BASELINE" ]]; then
  if diff -u "$POLICY_BASELINE" "$POLICY_SNAPSHOT" > "$POLICY_DIFF"; then
    echo "  ✓ no policy drift vs baseline" | tee -a "$REPORT"
  else
    echo "  ⚠ policy drift detected — see $POLICY_DIFF" | tee -a "$REPORT"
    cat "$POLICY_DIFF" | tee -a "$REPORT"
  fi
else
  echo "  ℹ no baseline at $POLICY_BASELINE — current snapshot saved" | tee -a "$REPORT"
  cp "$POLICY_SNAPSHOT" "$POLICY_DIFF"
fi

echo | tee -a "$REPORT"
echo "✔ RLS checks complete" | tee -a "$REPORT"
