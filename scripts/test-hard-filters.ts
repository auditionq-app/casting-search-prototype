// scripts/test-hard-filters.ts
//
// Phase 6 verification: runs example hard_filters combinations and checks
// (a) how many candidates come back, and (b) via EXPLAIN ANALYZE, whether
// Postgres is actually using the Phase 1 indexes rather than a sequential
// scan across all 5000 rows.
//
// Run with: npx tsx scripts/test-hard-filters.ts

import { getCandidateIds, explainCandidateQuery } from "../lib/search/candidate-search";
import type { HardFilters } from "../lib/query-understanding/types";

const TEST_CASES: { label: string; filters: HardFilters }[] = [
  {
    label: "gender + age range + language",
    filters: { gender: "male", age_min: 32, age_max: 36, languages: ["English"] },
  },
  {
    label: "age range only (50s)",
    filters: { age_min: 50, age_max: 59 },
  },
  {
    label: "no hard filters at all",
    filters: {},
  },
  {
    label: "language only",
    filters: { languages: ["Hindi"] },
  },
];

async function main() {
  for (const testCase of TEST_CASES) {
    console.log(`\n=== ${testCase.label} ===`);
    console.log("filters:", JSON.stringify(testCase.filters));

    const ids = await getCandidateIds(testCase.filters);
    console.log(`candidates returned: ${ids.length}`);

    const plan = await explainCandidateQuery(testCase.filters);
    console.log("--- EXPLAIN ANALYZE ---");
    console.log(plan);

    const usedSeqScan = plan.includes("Seq Scan");
    const usedIndex = plan.includes("Index Scan") || plan.includes("Bitmap Index Scan");
    console.log(
      usedIndex && !usedSeqScan
        ? "✅ used an index"
        : usedSeqScan
        ? "⚠️  fell back to sequential scan"
        : "? unclear from plan text — check manually above"
    );
  }
}

main()
  .catch((err) => {
    console.error("test-hard-filters failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));