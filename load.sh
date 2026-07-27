#!/usr/bin/env bash
# Install local Postgres + schema + applicant seed data for director talent search R&D.
# Usage:
#   ./load.sh           # 5000 applications
#   ./load.sh 10000
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

SEED_COUNT="${1:-5000}"
CONTAINER="director-applicant-rd-postgres"
DB="director_applicant_rd"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required."
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker Desktop and retry."
  exit 1
fi

echo "▶ Starting Postgres (host port 5434)..."
docker compose up -d

echo "▶ Waiting for health..."
for i in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d "$DB" >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "Postgres did not become ready."
    exit 1
  fi
  sleep 1
done

echo "▶ Applying schema..."
docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 < 01_schema.sql

echo "▶ Seeding ${SEED_COUNT} talent applications on one casting call..."
docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 \
  -v seed_count="$SEED_COUNT" < 02_seed.sql

echo ""
echo "✅ Ready"
echo "   URL: postgresql://postgres:postgres@localhost:5434/director_applicant_rd"
echo "   Casting call id: a0000000-0000-4000-8000-000000000003"
echo "   Baseline: docker exec -i $CONTAINER psql -U postgres -d $DB < 03_baseline_queries.sql"
echo ""
