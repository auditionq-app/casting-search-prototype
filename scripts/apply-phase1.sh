#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KIT="$ROOT/director-applicant-search-rd-kit/director-applicant-search"
CONTAINER="${CONTAINER:-director-applicant-rd-postgres}"
DB="${DB:-director_applicant_rd}"
SQL_FILE="$KIT/phase1_schema_additions.sql"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required." >&2
  exit 1
fi

if ! docker ps >/dev/null 2>&1; then
  echo "Docker is not reachable from this shell." >&2
  exit 1
fi

echo "Applying Phase 1 schema additions..."
docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 < "$SQL_FILE"
echo "Phase 1 schema additions applied."
