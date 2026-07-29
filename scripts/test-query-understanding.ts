// scripts/test-query-understanding.ts
//
// Standalone sanity check for the local Qwen provider, run BEFORE wiring
// it into the search route — per AGENT-LOCAL.md Phase 3.
//
// Run with: npx tsx scripts/test-query-understanding.ts
// (or: npx ts-node scripts/test-query-understanding.ts)

import { getQueryUnderstandingProvider } from "../lib/query-understanding";

const TEST_QUERIES = [
  "I want a 34-year-old man with fair skin, blue eyes, who speaks English",
  "Can play a mafia boss",
  "A warm but authoritative father figure in his 50s",
  "Someone with a strong royal presence who can play a prince",
];

async function main() {
  const provider = getQueryUnderstandingProvider();

  for (const query of TEST_QUERIES) {
    console.log("\n=== Query ===");
    console.log(query);

    const start = Date.now();
    try {
      const result = await provider.parse(query);
      const elapsed = Date.now() - start;
      console.log(`(${elapsed}ms)`);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error("FAILED:", err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});