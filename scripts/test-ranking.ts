// scripts/test-ranking.ts
//
// Phase 8 verification — and the first true end-to-end test of the whole
// pipeline: a real natural-language query goes through Phase 3 (parse),
// Phase 6 (hard-filter candidates), and Phase 7+8 (score + combine + rank).
//
// Run with: npx tsx scripts/test-ranking.ts "your query here"
// If no query is given, uses one of the Phase 10 example queries.

import { getQueryUnderstandingProvider } from "../lib/query-understanding";
import { rankCandidates, DEFAULT_WEIGHTS } from "../lib/search/rank";
import { prisma } from "../lib/prisma";

async function main() {
  const query =
    process.argv[2] ?? "A warm but authoritative father figure in his 50s";

  console.log(`Query: "${query}"`);
  console.log(`Weights:`, DEFAULT_WEIGHTS);

  const provider = getQueryUnderstandingProvider();
  const parsed = await provider.parse(query);
  console.log("\nParsed (Phase 3):", JSON.stringify(parsed, null, 2));

  const { results, totalCandidates } = await rankCandidates(
    parsed.hard_filters,
    parsed.semantic_query,
    parsed.soft_preferences,
    { page: 1, pageSize: 10 }
  );

  console.log(`\nCandidate pool after hard filters: ${totalCandidates}`);

  const names = await prisma.artist_profiles.findMany({
    where: { id: { in: results.map((r) => r.id) } },
    select: { id: true, full_name: true },
  });
  const nameMap = new Map(names.map((n) => [n.id, n.full_name]));

  console.log("\nTop 10 ranked results:\n");
  for (const r of results) {
    console.log(
      `${nameMap.get(r.id)} — final: ${r.finalScore.toFixed(3)} ` +
        `(vector: ${r.vectorScore.toFixed(3)}, lexical: ${r.lexicalScore.toFixed(
          3
        )}, softMatch: ${r.softMatchScore.toFixed(3)})`
    );
  }
}

main()
  .catch((err) => {
    console.error("test-ranking failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));