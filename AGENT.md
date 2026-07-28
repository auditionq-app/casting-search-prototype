# AGENT-LOCAL.md — AI Casting Search Prototype (Regular Tier, Fully Local)

## What this is

A standalone prototype of a natural-language, AI-powered actor search feature for a casting platform (`auditionq-app`). Independent of the main app (separate DB/repo), but must mirror the main app's real schema so it can be merged in later. Build **only the Regular tier** in this phase. Do not build Premium (reranker layer) yet.

This version uses **fully local, open-source models — no paid API calls at all.**

## Hard constraints — read before writing any code

- **Runs on a laptop right now.** GPU: NVIDIA MX450, **2GB VRAM only**. Every model choice must fit this. It will later move to a VPS (4-core CPU, 16GB RAM, no GPU) — nothing should assume more GPU than the laptop has; nothing should hardcode laptop-specific paths either.
- **No paid API calls of any kind in this phase.** No Claude, OpenAI, or Voyage calls. Everything runs locally.
- **No separate vector database.** PostgreSQL + `pgvector` only.
- **No ANN index (HNSW/IVFFlat) yet.** Prototype-scale actor count; brute-force cosine similarity is fast enough.
- **No reranker in this phase.** Reranking is a Premium-only feature, added later.
- **Don't over-build the UI.** A plain search bar + results list is enough.
- **Ask before deviating** from this plan (model swaps, schema changes, new dependencies).

## Models used in this phase

| Task | Model | Why this one, at this size |
|---|---|---|
| Query understanding | `qwen2.5:1.5b-instruct-q4_K_M` via Ollama | Fits comfortably in 2GB VRAM (~1GB footprint); best structured-output reliability among models this small |
| Embeddings | `Xenova/bge-small-en-v1.5` via `@xenova/transformers` | Runs inside the Node app, CPU or GPU, no quality tradeoff vs paid embeddings |
| Reranking | None in this phase | Deferred to Premium |

**Use grammar-constrained / JSON-mode output for the query-understanding call** (Ollama's structured output mode, or a GBNF grammar via llama.cpp) — do not rely on free-form generation to produce valid JSON. A 1.5B model will occasionally extract a wrong value, but the *shape* of the output must always be guaranteed valid, non-negotiably.

## CRITICAL: the query-understanding step must be swappable between local Qwen and Claude Haiku

This is a hard requirement, not a nice-to-have. Build the query-understanding call behind a single interface, e.g.:

```ts
interface QueryUnderstandingProvider {
  parse(query: string): Promise<{
    hard_filters: Record<string, unknown>;
    soft_preferences: Record<string, unknown>;
    semantic_query: string;
  }>;
}
```

- One implementation calls local Qwen via Ollama.
- A second implementation (can be stubbed/empty in this phase, but the interface must exist) calls Claude Haiku.
- Which one is active is a **config value** (e.g. an env var like `QUERY_PROVIDER=local|haiku`), not a code change.
- Both implementations must return the exact same JSON shape, so nothing downstream (SQL filtering, scoring, ranking) needs to know or care which provider produced it.

Do not hardcode Ollama calls directly into the search route — always go through this interface. This is the single most important structural decision in this build: it's what lets the project move from "fully local, laptop, zero cost" to "Haiku, paid, more reliable" later by flipping one config value, without touching the rest of the pipeline.

**Concrete output schema** (both implementations must produce exactly this shape):
```json
{
  "hard_filters": {
    "gender": "male",
    "age_min": 48,
    "age_max": 58,
    "languages": ["English"]
  },
  "soft_preferences": {
    "traits": ["warm", "authoritative"]
  },
  "semantic_query": "warm yet authoritative father figure, commanding presence with warmth"
}
```
- `hard_filters`: only include a key if the query stated something concrete enough to exclude on (age range, not exact age; gender only if stated; languages only if stated).
- `soft_preferences`: attributes worth ranking on but not excluding on — start with just a `traits` string array; expand later if needed.
- `semantic_query`: always present, a clean restatement of the archetype/vibe description for embedding, even if the query was purely factual (in that case, keep it short/generic rather than empty).

## Tech stack

- Next.js + TypeScript + Tailwind
- Prisma + PostgreSQL (with `pgvector` extension)
- BullMQ + Redis (reuse the same async-worker pattern as `video-profile-prototype`)
- Ollama (local LLM serving)
- `@xenova/transformers` (local embeddings)

## Reference schema (matches the real app — do not diverge without asking)

Core tables (from the existing app's R&D kit): `users`, `director_profiles`, `artist_profiles`, `casting_calls`, `applications`, `role_match_scores`.

**This prototype's database is the R&D kit itself, not a fresh schema.** The kit at `director-applicant-search-rd-kit/director-applicant-search/` already contains a working Postgres 15 instance (via `docker-compose.yml`, port `5434`, db `director_applicant_rd`) with schema + realistic seed data (`01_schema.sql`, `02_seed.sql`) and baseline benchmark queries (`03_baseline_queries.sql`, `04_experiment_ideas.sql`). Do not build a new database from scratch — start this one via `load.sh`, then apply the additions below **on top of** its existing schema. This also means baseline performance (pre-AI-search) is already measurable via `03_baseline_queries.sql` — worth running once before adding anything, so there's a genuine before/after comparison later.

Additions needed on `artist_profiles`:
```sql
ALTER TABLE artist_profiles ADD COLUMN search_document text;
ALTER TABLE artist_profiles ADD COLUMN embedding vector(384); -- bge-small dim
ALTER TABLE artist_profiles ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(search_document, ''))) STORED;
```

Indexes required:
- B-tree on scalar filter columns (age/date_of_birth, gender, height)
- GIN on array/jsonb columns (languages, specializations, locations)
- GIN + `pg_trgm` on actor name (fuzzy name search)
- GIN on `search_tsv` (full-text search)

`matching_percentage` / `role_match_scores` is a **separate, existing signal** (rule-based match against a specific role). Do not merge it with the new semantic score — keep them as two distinct signals.

## Build order — follow these phases in sequence, don't skip ahead

0. **Stand up the R&D kit as-is, unmodified — except one required fix.** The kit's `docker-compose.yml` uses `postgres:15-alpine`, which does **not** include the `pgvector` extension. Before running `load.sh`, change the image to `pgvector/pgvector:pg15` (same Postgres 15, pgvector pre-installed, no other config changes needed). Then run `chmod +x load.sh && ./load.sh 5000` (or `10000`) inside `director-applicant-search/`. Confirm the DB is reachable (`psql "postgresql://postgres:postgres@localhost:5434/director_applicant_rd"`) and run `03_baseline_queries.sql` once — **save the output to a file** (e.g. `docs/phase0-baseline.md`) so there's a real before/after comparison once the AI search layer is added. Ignore any zip/`rd-kits/`-path references inside the kit's own README files — those are leftover from how it was originally packaged, not relevant to this project's actual folder layout.
1. **Schema additions** — run `CREATE EXTENSION IF NOT EXISTS vector;` first, then add `search_document`, `embedding`, `search_tsv` + all indexes listed above **on top of** the R&D kit's existing schema (do not recreate the base tables).
2. **Local model setup** — stand up Ollama with `qwen2.5:1.5b-instruct-q4_K_M`, and the `bge-small` embedding pipeline. Test both in isolation before wiring into anything else.
3. **Query-understanding interface** — build the `QueryUnderstandingProvider` interface described above, with a working local-Qwen implementation and a stub Haiku implementation, switchable via config. Test the Qwen path standalone against real example queries (see Phase 10) before wiring into the pipeline — check that output JSON is always well-formed.
4. **Ingestion worker (BullMQ)** — on actor profile create/update: build `search_document` from bio/roles/skills/experience, generate its embedding, save both. Test manually against a handful of profiles before scaling up.
5. **Backfill existing seed data** — the R&D kit already seeds `artist_profiles` with varied `bio`, `specializations`, `experience_level`, `genre_preferences` (from `02_seed.sql`, Phase 0). These rows predate the Phase 4 worker, so write a one-off script to run every existing row through it and populate `search_document`/`embedding` — do not seed new fake data, the kit's data is already realistic and varied enough.
6. **SQL filtering** — turn `hard_filters` into a `WHERE` clause using Phase 1 indexes; return a bounded candidate set (e.g. top 200–500). Verify with `EXPLAIN ANALYZE` that indexes are actually used.
7. **Vector + lexical scoring** — on the bounded candidate set only: cosine similarity (embedding vs semantic_query embedding) + `ts_rank` (lexical). Normalize both to a comparable scale before combining.
8. **Combine into final ranking** — application-level weighted score (soft filter match + vector similarity + lexical score), sort, paginate. Expect to tune weights by eye against real results.
9. **Minimal API + UI** — one API route (query in, ranked results out) + a plain search bar and results list.
10. **Test against real casting queries** — validate with queries like:
    - "I want a 34-year-old man with fair skin, blue eyes, who speaks English"
    - "Can play a mafia boss"
    - "A warm but authoritative father figure in his 50s"
    - "Someone with a strong royal presence who can play a prince"

    Adjust the Qwen prompt/grammar, search-document content, and ranking weights based on real results, not assumptions.

## Explicitly out of scope for this phase

- Premium tier / reranking (any model, local or paid)
- Auth (placeholder `userId` params are fine, same as `video-profile-prototype`)
- ANN indexing
- Any paid API call

## Working style notes

- Commit at the end of each phase, not mid-phase.
- Give a brief explanation of what a phase does before implementing it.
- Age and similar attributes should default to **ranges**, not exact-only matches, unless the query explicitly says "exactly."
- Split filters into **hard** (SQL exclude) vs **soft** (rank, don't exclude) in the query-understanding output schema — this belongs in the schema, not bolted on later.
- Keep the `QueryUnderstandingProvider` interface clean — this is what makes the future Qwen-to-Haiku (or laptop-to-VPS) switch a config change instead of a rewrite.
