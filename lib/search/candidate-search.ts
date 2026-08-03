// lib/search/candidate-search.ts

import { Prisma } from "../../app/generated/prisma/client";
import { prisma } from "../prisma";
import { buildHardFilterConditions } from "./hard-filters";
import type { HardFilters } from "../query-understanding/types";

const DEFAULT_CANDIDATE_LIMIT = 500;

export interface CandidateRow {
  id: string;
}

// Returns a bounded candidate set (id only) matching hard_filters. This is
// Phase 6's output — Phase 7 takes these ids and applies vector + lexical
// scoring on just this bounded set, not the whole table.
export async function getCandidateIds(
  filters: HardFilters,
  limit: number = DEFAULT_CANDIDATE_LIMIT
): Promise<string[]> {
  const whereClause = buildHardFilterConditions(filters);

  const rows = await prisma.$queryRaw<CandidateRow[]>(Prisma.sql`
    SELECT id
    FROM artist_profiles
    WHERE ${whereClause}
    LIMIT ${limit}
  `);

  return rows.map((r) => r.id);
}

// Same query, but wrapped in EXPLAIN ANALYZE — for verifying Phase 1's
// indexes are actually being used, not falling back to a sequential scan.
// Per AGENT-LOCAL.md Phase 6: "Verify with EXPLAIN ANALYZE that indexes
// are actually used."
export async function explainCandidateQuery(
  filters: HardFilters,
  limit: number = DEFAULT_CANDIDATE_LIMIT
): Promise<string> {
  const whereClause = buildHardFilterConditions(filters);

  const rows = await prisma.$queryRaw<{ "QUERY PLAN": string }[]>(Prisma.sql`
    EXPLAIN ANALYZE
    SELECT id
    FROM artist_profiles
    WHERE ${whereClause}
    LIMIT ${limit}
  `);

  return rows.map((r) => r["QUERY PLAN"]).join("\n");
}