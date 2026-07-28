#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${CONTAINER:-director-applicant-rd-postgres}"
DB="${DB:-director_applicant_rd}"

printf 'vector extension: '
docker exec "$CONTAINER" psql -U postgres -d "$DB" -tAc "SELECT extname FROM pg_extension WHERE extname='vector';"
printf 'search_document/embedding/search_tsv columns: '
docker exec "$CONTAINER" psql -U postgres -d "$DB" -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='artist_profiles' AND column_name IN ('search_document','embedding','search_tsv') ORDER BY 1;"
printf 'indexes: '
docker exec "$CONTAINER" psql -U postgres -d "$DB" -tAc "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='artist_profiles' AND indexname LIKE 'idx_artist_profiles_%' ORDER BY indexname;"
