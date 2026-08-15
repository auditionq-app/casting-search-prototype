// scripts/test-scoring.ts
//
// Phase 7 verification: gets a candidate set (Phase 6) then scores it
// (Phase 7) against a semantic_query. Prints top candidates sorted by a
// simple average of vectorScore/lexicalScore — NOT the real Phase 8
// weighting yet, just enough to sanity-check the numbers look reasonable
// before Phase 8 does actual weighted combination + tuning.
//
// Run with: npx tsx scripts/test-scoring.ts

import { getCandidateIds } from "../lib/search/candidate-search";
import { scoreCandidates } from "../lib/search/scoring";
import { prisma } from "../lib/prisma";

async function main() {
  const semanticQuery = "warm yet authoritative father figure, commanding presence with warmth";

  console.log(`Semantic query: "${semanticQuery}"`);

  // No hard filters here — just want a broad candidate pool to see scoring spread.
  const candidateIds = await getCandidateIds({});
  console.log(`Candidate pool size: ${candidateIds.length}`);

  const scores = await scoreCandidates(candidateIds, semanticQuery);

  const ranked = [...scores].sort(
    (a, b) => b.vectorScore + b.lexicalScore - (a.vectorScore + a.lexicalScore)
  );

  const top10 = ranked.slice(0, 10);
  const names = await prisma.artist_profiles.findMany({
    where: { id: { in: top10.map((c) => c.id) } },
    select: { id: true, full_name: true, bio: true },
  });
  const nameMap = new Map(names.map((n) => [n.id, n.full_name]));

  console.log("\nTop 10 (naive avg of normalized scores, not final Phase 8 weighting):\n");
  for (const c of top10) {
    console.log(
      `${nameMap.get(c.id)} — vector: ${c.vectorScore.toFixed(3)} (raw cos: ${c.rawCosineSimilarity.toFixed(
        3
      )}), lexical: ${c.lexicalScore.toFixed(3)} (raw ts_rank semantic: ${c.rawTsRankSemantic.toFixed(
        4
      )}, traits: ${c.rawTsRankTraits.toFixed(4)})`
    );
  }
}

main()
  .catch((err) => {
    console.error("test-scoring failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));