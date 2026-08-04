// lib/search/rank.ts

import { getCandidateIds } from "./candidate-search";
import { scoreCandidates, type CandidateScore } from "./scoring";
import type { HardFilters, SoftPreferences } from "../query-understanding/types";

// Starting weights — deliberately not fine-tuned. Per AGENT-LOCAL.md Phase 8:
// "Expect to tune weights by eye against real results." Adjust these three
// numbers directly based on what actually looks right once you're staring
// at real ranked output, not by reasoning about it in the abstract.
export const DEFAULT_WEIGHTS = {
  vector: 0.5,
  lexical: 0.2,
  softMatch: 0.3,
};

export interface RankedCandidate extends CandidateScore {
  finalScore: number;
}

export interface RankResult {
  results: RankedCandidate[];
  totalCandidates: number;
}

function computeFinalScore(
  score: CandidateScore,
  weights: typeof DEFAULT_WEIGHTS
): number {
  return (
    weights.vector * score.vectorScore +
    weights.lexical * score.lexicalScore +
    weights.softMatch * score.softMatchScore
  );
}

// Full Phase 6 -> 7 -> 8 pipeline: bounded candidate set, scored on three
// signals, combined into one final ranking, paginated.
export async function rankCandidates(
  hardFilters: HardFilters,
  semanticQuery: string,
  softPreferences: SoftPreferences,
  options: {
    page?: number;
    pageSize?: number;
    weights?: typeof DEFAULT_WEIGHTS;
    candidatePoolSize?: number;
  } = {}
): Promise<RankResult> {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const candidatePoolSize = options.candidatePoolSize ?? 500;

  const candidateIds = await getCandidateIds(hardFilters, candidatePoolSize);
  const scores = await scoreCandidates(
    candidateIds,
    semanticQuery,
    softPreferences.traits ?? []
  );

  const ranked: RankedCandidate[] = scores
    .map((score) => ({ ...score, finalScore: computeFinalScore(score, weights) }))
    .sort((a, b) => b.finalScore - a.finalScore);

  const start = (page - 1) * pageSize;
  const paginated = ranked.slice(start, start + pageSize);

  return {
    results: paginated,
    totalCandidates: ranked.length,
  };
}