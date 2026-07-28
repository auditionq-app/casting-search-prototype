# Director Applicant Search — R&D Database Kit

Set up a local Postgres database with a **realistic applications + talent profile schema** and thousands of applicants on one casting call. Use it to research and compare ways to **search, filter, and rank talents** efficiently when a director reviews applications — then recommend the best approach.

**Location in this project:** `director-applicant-search-rd-kit/director-applicant-search/`

*(Note: this kit was originally shared as a zip under an `rd-kits/` path — that reference is leftover from how it was packaged, not where it lives in this workspace. Use the path above.)*

---

## Package contents

| File | Description |
|------|-------------|
| `docker-compose.yml` | PostgreSQL, **pgvector-enabled** (`pgvector/pgvector:pg15`) |
| `01_schema.sql` | `users`, `director_profiles`, `artist_profiles`, `casting_calls`, `applications`, `role_match_scores` (columns/indexes aligned with the live app) |
| `02_seed.sql` | One casting call (2 roles) + N talent applications with match scores (default **5000**) |
| `03_baseline_queries.sql` | Current-style filter / rank queries with `EXPLAIN (ANALYZE, BUFFERS)` |
| `04_experiment_ideas.sql` | Starter ideas (indexes, FTS, trigram, SQL pagination, etc.) |
| `load.sh` | One-command install |
| `README.md` | Same instructions (inside the folder) |

---

## Prerequisites

- Docker Desktop (or Docker Engine) running on your machine

---

## Install and load data

```bash
cd director-applicant-search-rd-kit/director-applicant-search
chmod +x load.sh

./load.sh           # 5000 applications
./load.sh 10000     # larger volume
./load.sh 25000     # stress tests
```

---

## Connection

| Setting | Value |
|---------|-------|
| Host | `localhost` |
| Port | `5434` |
| Database | `director_applicant_rd` |
| User | `postgres` |
| Password | `postgres` |

```bash
psql "postgresql://postgres:postgres@localhost:5434/director_applicant_rd"
```

Or:

```bash
docker exec -it director-applicant-rd-postgres psql -U postgres -d director_applicant_rd
```

**Seeded casting call id (for queries):**
`a0000000-0000-4000-8000-000000000003`

---

## Manual install (optional)

```bash
docker compose up -d
docker exec director-applicant-rd-postgres pg_isready -U postgres -d director_applicant_rd

docker exec -i director-applicant-rd-postgres \
  psql -U postgres -d director_applicant_rd -v ON_ERROR_STOP=1 < 01_schema.sql

docker exec -i director-applicant-rd-postgres \
  psql -U postgres -d director_applicant_rd -v ON_ERROR_STOP=1 -v seed_count=5000 < 02_seed.sql
```

---

## R&D goal

When **thousands of talents apply** to one casting call, the director needs fast, accurate ways to:

- Filter by traits (gender, age, height, skills, languages, location, experience, match %)
- Rank by **matching percentage** (and related sorts)
- Optionally search by **talent name** / free text over profile fields
- Paginate without loading the entire applicant set into application memory

Evaluate multiple approaches (see `04_experiment_ideas.sql` and your own) and recommend the best fit based on latency at scale, index cost, result quality, and operational complexity.

---

## Verify data

```sql
SELECT count(*) FROM applications;
SELECT count(*) FROM artist_profiles;
SELECT matching_percentage, count(*)
FROM applications
GROUP BY 1
ORDER BY 1 DESC
LIMIT 10;
```

---

## Reset and reseed

```bash
docker compose down -v
./load.sh 10000
```

---

## Stop

```bash
docker compose down
```