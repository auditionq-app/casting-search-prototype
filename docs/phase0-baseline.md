# Phase 0 Baseline Results

**Date run:** 2026-07-27
**Seed size (`./load.sh N`):** 5000

## Query 1 — Rank by match % + paginate (no extra filters)
- Latency: 0.714 ms (Execution Time)
- Plan type: **Index Scan** (`idx_applications_matching_percentage`)
- Notes: Already fast, index working correctly. No action needed.

## Query 2 — Match % ≥70 + gender + language + specialization filters
- Latency: 0.461 ms
- Plan type: **Index Scan** (same index, plus filter on `artist_profiles`)
- Notes: Fast despite jsonb/array filters. No action needed yet.

## Query 3 — Age range + location text match + match % floor
- Latency: 3.075 ms
- Plan type: **Seq Scan** on `artist_profiles` — 4,749 of 5,000 rows filtered out
- Notes: **Flagged for optimization.** The `age()` function call and `LIKE` on location can't use a plain index. Matches the generated `age_years` column idea from `04_experiment_ideas.sql`. Will get meaningfully worse as actor count grows — fix before scaling seed data up.

## Query 4 — Load full unfiltered list, sort in memory
- Latency: 5.780 ms
- Plan type: **Seq Scan** on all three joined tables (`applications`, `artist_profiles`, `users`), full 5,000-row hash join
- Notes: **Flagged for optimization.** This is the "load everything into app memory" pattern — scales linearly and badly. Needs SQL-side pagination/limiting instead of loading the whole set.

## Query 5 — Name search (`LIKE '%sharma%'`)
- Latency: 2.188 ms
- Plan type: **Seq Scan** on `artist_profiles` — 4,500 of 5,000 rows filtered out
- Notes: **Flagged for optimization.** Classic case for a trigram (`pg_trgm`) index — already listed as a candidate in `04_experiment_ideas.sql`.

## Verification data
- `applications` count: 5000 ✅ matches seed target
- `matching_percentage` bucket distribution: roughly even spread across buckets 4–10 (357–939 rows each) — confirms seed data has realistic variety, not clustered artificially
- `CREATE EXTENSION IF NOT EXISTS vector;` check: pgvector-enabled image is configured and ready for Phase 1 schema work

---

## Summary — what to fix, and when

Three queries (3, 4, 5) are doing full table scans today. At 5,000 rows this costs only a few milliseconds, but **plan type, not current latency, is the thing to track** — these are exactly the queries that will degrade as the actor count grows toward tens of thousands. Two queries (1, 2) already use indexes correctly and need no changes.

This baseline file should be re-run and compared against **after** the Phase 1 schema/index additions (and again after any performance experiments from `04_experiment_ideas.sql`) to confirm real improvement, not just assumed improvement.