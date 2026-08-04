// lib/search/scoring.ts

import { Prisma } from "../../app/generated/prisma/client";
import { prisma } from "../prisma";
import { embedText } from "../embeddings/embedder";

export interface CandidateScore {
  id: string;
  // Raw values, kept for debugging/tuning (per AGENT-LOCAL.md Phase 8:
  // "Expect to tune weights by eye against real results")
  rawCosineSimilarity: number;
  rawTsRank: number;
  // Normalized 0-1 within this candidate set — what Phase 8 will combine.
  vectorScore: number;
  lexicalScore: number;
}

interface RawScoreRow {
  id: string;
  cosine_similarity: number;
  ts_rank: number;
}

// Min-max normalize a list of numbers to [0, 1]. If all values are equal,
// this is either "no signal at all" (everyone scored 0 — e.g. no lexical
// matches found) or "a genuine tie at a real value" (e.g. everyone matched
// equally well). Those mean opposite things, so they're handled separately:
// an all-zero tie stays 0, any other tie becomes 1.
function minMaxNormalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    return values.map(() => (max === 0 ? 0 : 1));
  }
  return values.map((v) => (v - min) / (max - min));
}

// plainto_tsquery ANDs every word together — a candidate only scores > 0 if
// it contains EVERY word in the query literally. For short factual queries
// that's fine, but for archetype/vibe phrases ("warm yet authoritative
// father figure") it means almost nothing will ever match, since real
// bios rarely contain every one of those words verbatim. Building an
// OR-query instead (any word present contributes partial credit) gives a
// much more usable lexical signal for this kind of query, while single-word
// or fully-matching queries still behave sensibly.
function buildOrTsQuery(semanticQuery: string): Prisma.Sql {
  const words = semanticQuery
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    return Prisma.sql`plainto_tsquery('english', '')`;
  }

  const parts = words.map((w) => Prisma.sql`plainto_tsquery('english', ${w})`);
  return Prisma.join(parts, " || ");
}

// Scores a bounded candidate set (from Phase 6's getCandidateIds) against
// semantic_query, via cosine similarity (pgvector) and lexical rank
// (search_tsv). Both signals are computed in a single SQL round-trip, then
// normalized in application code — min-max within THIS candidate set,
// rather than assuming fixed bounds, since ts_rank's scale varies with
// query complexity and candidate composition.
export async function scoreCandidates(
  candidateIds: string[],
  semanticQuery: string
): Promise<CandidateScore[]> {
  if (candidateIds.length === 0) return [];

  const queryEmbedding = await embedText(semanticQuery);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const rows = await prisma.$queryRaw<RawScoreRow[]>(Prisma.sql`
    SELECT
      id,
      1 - (embedding <=> ${vectorLiteral}::vector) AS cosine_similarity,
      ts_rank(search_tsv, ${buildOrTsQuery(semanticQuery)}) AS ts_rank
    FROM artist_profiles
    WHERE id = ANY(${candidateIds}::uuid[])
  `);

  const cosineValues = rows.map((r) => r.cosine_similarity);
  const tsRankValues = rows.map((r) => r.ts_rank);

  const normalizedVector = minMaxNormalize(cosineValues);
  const normalizedLexical = minMaxNormalize(tsRankValues);

  return rows.map((row, i) => ({
    id: row.id,
    rawCosineSimilarity: row.cosine_similarity,
    rawTsRank: row.ts_rank,
    vectorScore: normalizedVector[i],
    lexicalScore: normalizedLexical[i],
  }));
}