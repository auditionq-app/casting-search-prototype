// lib/search/scoring.ts

import { Prisma } from "../../app/generated/prisma/client";
import { prisma } from "../prisma";
import { embedText } from "../embeddings/embedder";

export interface CandidateScore {
  id: string;
  rawCosineSimilarity: number;
  rawTsRankSemantic: number;
  rawTsRankTraits: number;
  vectorScore: number;
  lexicalScore: number;
  softMatchScore: number;
}

interface RawScoreRow {
  id: string;
  cosine_similarity: number;
  ts_rank_semantic: number;
  ts_rank_traits: number;
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
// three signals: cosine similarity (vector), ts_rank against semantic_query
// (lexical), and ts_rank against soft_preferences.traits (soft match) —
// all normalized min-max within this candidate set. Phase 8 combines these
// three into a final weighted score.
export async function scoreCandidates(
  candidateIds: string[],
  semanticQuery: string,
  traits: string[] = []
): Promise<CandidateScore[]> {
  if (candidateIds.length === 0) return [];

  const queryEmbedding = await embedText(semanticQuery);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  // traits joined into one space-separated string, then OR-tsquery'd the
  // same way as semantic_query — an empty traits list naturally produces
  // an empty tsquery, which ts_rank's against as 0 for every row (a flat,
  // harmless contribution that doesn't distort relative ranking).
  const traitsText = traits.join(" ");

  const rows = await prisma.$queryRaw<RawScoreRow[]>(Prisma.sql`
    SELECT
      id,
      1 - (embedding <=> ${vectorLiteral}::vector) AS cosine_similarity,
      ts_rank(search_tsv, ${buildOrTsQuery(semanticQuery)}) AS ts_rank_semantic,
      ts_rank(search_tsv, ${buildOrTsQuery(traitsText)}) AS ts_rank_traits
    FROM artist_profiles
    WHERE id = ANY(${candidateIds}::uuid[])
  `);

  const cosineValues = rows.map((r) => r.cosine_similarity);
  const semanticRankValues = rows.map((r) => r.ts_rank_semantic);
  const traitsRankValues = rows.map((r) => r.ts_rank_traits);

  const normalizedVector = minMaxNormalize(cosineValues);
  const normalizedLexical = minMaxNormalize(semanticRankValues);
  const normalizedSoftMatch = minMaxNormalize(traitsRankValues);

  return rows.map((row, i) => ({
    id: row.id,
    rawCosineSimilarity: row.cosine_similarity,
    rawTsRankSemantic: row.ts_rank_semantic,
    rawTsRankTraits: row.ts_rank_traits,
    vectorScore: normalizedVector[i],
    lexicalScore: normalizedLexical[i],
    softMatchScore: normalizedSoftMatch[i],
  }));
}