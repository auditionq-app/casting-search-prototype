# PLAN.md — Execution Plan for AI Casting Search Prototype (Local/Qwen version)

Companion to `AGENT.md`. That file tells the AI agent the rules and constraints. This file is your checklist to track progress phase by phase, with what to verify before moving on. Check items off as the agent completes them — don't let it skip ahead to the next phase until the current one's verification checks pass.

---

## Phase 0 — Stand up the R&D kit (base database)

**Goal:** The existing R&D kit is running, unmodified except one required fix, with a measurable baseline saved to a file.

- [x] **Fix `docker-compose.yml` first**: change `image: postgres:15-alpine` to `image: pgvector/pgvector:pg15` (the kit's default image doesn't include the `pgvector` extension, which Phase 1 needs)
- [x] `chmod +x load.sh` run inside `director-applicant-search/`
- [x] `./load.sh 5000` (or `10000`) completes without errors
- [x] Can connect: `psql "postgresql://postgres:postgres@localhost:5434/director_applicant_rd"`
- [x] `SELECT count(*) FROM applications;` returns expected seeded count
- [x] `03_baseline_queries.sql` run once, output **saved to a file** (e.g. `docs/phase0-baseline.md`) — this is your only real before/after comparison once the AI search layer is added
- [x] Ignore any zip/`rd-kits/`-path references in the kit's own README files — leftover packaging references, not relevant here

**Verify before moving on:** DB is reachable, seeded, pgvector extension available, and a baseline performance file exists on disk.

---

## Phase 1 — Schema additions

**Goal:** The R&D kit's existing DB has the extra tables/columns/indexes needed for AI search, added on top — not a new database.

- [ ] `CREATE EXTENSION IF NOT EXISTS vector;` run successfully (requires the `pgvector/pgvector:pg15` image from Phase 0)
- [ ] `artist_profiles` table exists (already present from Phase 0, R&D kit structure — do not recreate)
- [ ] Added: `search_document` (text), `embedding` (vector(384)), `search_tsv` (generated tsvector)
- [ ] B-tree indexes on scalar filters (age/date_of_birth, gender, height)
- [ ] GIN indexes on array/jsonb columns (languages, specializations, locations)
- [ ] GIN + `pg_trgm` index on actor name
- [ ] GIN index on `search_tsv`

**Verify before moving on:** Run `\d artist_profiles` in psql — confirm all columns and indexes exist. No data needed yet, just structure.

---

## Phase 2 — Local model setup

**Goal:** Ollama (Qwen) and the embedding pipeline both run and respond correctly, in isolation.

- [ ] Ollama installed, `qwen2.5:1.5b-instruct-q4_K_M` pulled and running
- [ ] Test call to Ollama returns a response (plain curl/test script, not yet wired into the app)
- [ ] `@xenova/transformers` installed, `bge-small-en-v1.5` pipeline loads
- [ ] Test embedding call on a sample sentence returns a 384-length vector

**Verify before moving on:** You can manually run a test script that (a) sends a prompt to Qwen and gets text back, (b) embeds a sentence and gets a vector back. Neither is connected to the database or app yet.

---

## Phase 3 — Query-understanding interface

**Goal:** A working function that turns a natural-language query into structured JSON, swappable between Qwen and Haiku later.

- [ ] `QueryUnderstandingProvider` interface defined (per `AGENT.md` spec)
- [ ] Local-Qwen implementation built, using grammar-constrained/JSON-mode output
- [ ] Haiku implementation stubbed (doesn't need to work yet, just exist with the same interface shape)
- [ ] Config value controls which provider is active (e.g. `QUERY_PROVIDER=local`)

**Verify before moving on:** Manually run these test queries through the Qwen implementation and confirm the JSON is always well-formed and roughly sensible:
- "I want a 34-year-old man with fair skin, blue eyes, who speaks English"
- "Can play a mafia boss"
- "A warm but authoritative father figure in his 50s"
- "Someone with a strong royal presence who can play a prince"

Check specifically: did it correctly split hard facts (age, gender) from vibe/semantic description? Is the JSON shape identical across all four test queries?

---

## Phase 4 — Ingestion worker (BullMQ)

**Goal:** Actor profile create/update automatically produces a search document + embedding.

- [ ] BullMQ job triggers on actor profile create/update
- [ ] Worker builds `search_document` from bio/roles/skills/experience
- [ ] Worker generates embedding for the search document (Phase 2 pipeline)
- [ ] Worker saves both back to `artist_profiles`

**Verify before moving on:** Manually create/update 3-5 test actor profiles with varied bios. Check the resulting `search_document` in the DB — does it read as a sensible summary? Confirm `embedding` is populated (not null) for each.

---

## Phase 5 — Backfill existing seed data through the worker

**Goal:** The R&D kit's already-seeded actors (from Phase 0) get enriched, since they predate the Phase 4 worker.

- [ ] Confirm the R&D kit's `artist_profiles` already have `bio`, `specializations`, `experience_level`, `genre_preferences` populated (they do, from `02_seed.sql`) — no new seeding needed
- [ ] Write a one-off backfill script that runs every existing `artist_profiles` row through the Phase 4 enrichment logic (since they were seeded before the worker existed, they won't trigger the create/update hook automatically)
- [ ] Backfill completes for all seeded rows
- [ ] Spot-check variety: different ages, experience levels, specializations are represented (they should be, since the kit seeds varied data)

**Verify before moving on:** `SELECT count(*) FROM artist_profiles WHERE embedding IS NOT NULL;` should match `SELECT count(*) FROM artist_profiles;` — everyone backfilled, nobody missed.

---

## Phase 6 — SQL filtering

**Goal:** Hard filters correctly narrow the candidate pool using indexes, not table scans.

- [ ] Function/query that converts `hard_filters` JSON into a `WHERE` clause
- [ ] Returns a bounded candidate set (e.g. top 200–500), not everything matching
- [ ] Confirmed via `EXPLAIN ANALYZE` that indexes from Phase 1 are actually used

**Verify before moving on:** Run `EXPLAIN ANALYZE` on a filtered query — look for "Index Scan" not "Seq Scan" on your indexed columns. If you see a sequential scan on a large table, something's wrong before moving on.

---

## Phase 7 — Vector + lexical scoring

**Goal:** Two independent relevance signals computed on the narrowed candidate set.

- [ ] Cosine similarity computed: candidate embeddings vs `semantic_query` embedding
- [ ] `ts_rank` computed: `search_tsv` vs lexical terms from the query
- [ ] Both scores normalized to a comparable scale (not raw/unnormalized)

**Verify before moving on:** Manually inspect scores for a test query — do the top-scoring actors by vector similarity actually make intuitive sense for the archetype searched?

---

## Phase 8 — Combine into final ranking

**Goal:** One final ranked list per search, from combining all signals.

- [ ] Weighted formula combines: hard-filter/soft-preference match + vector similarity + lexical score
- [ ] Results sorted by final score, paginated

**Verify before moving on:** Run the 4 test queries from Phase 3 end-to-end. Do the top few results per query look like sensible matches? Adjust weights if not — this is expected to take iteration.

---

## Phase 9 — Minimal API + UI

**Goal:** A working, if plain, end-to-end feature you can actually use.

- [ ] One API route: query in, ranked results out
- [ ] Basic search bar + results list UI (no styling polish needed)

**Verify before moving on:** You can type a query into the actual UI and see real ranked results, not just call an API route manually.

---

## Phase 10 — Test against real casting queries

**Goal:** Confidence the whole pipeline works before calling Regular tier "done."

- [ ] Re-run all 4 example queries through the full UI
- [ ] Try 5-10 of your own realistic casting queries
- [ ] Note any queries that return poor/irrelevant results
- [ ] Adjust Qwen prompt/grammar, `search_document` content, or ranking weights based on findings

**Done when:** Results are consistently sensible across a range of query types (exact-fact queries, pure archetype queries, and mixed queries) — not perfect, but clearly working as intended.

---

## After this plan is complete

Do not start Premium (reranker) work until every phase above is checked off and Phase 10 testing feels solid. Premium is a separate, additive plan built on top of this one — it is not part of this plan.