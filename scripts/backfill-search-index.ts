// scripts/backfill-search-index.ts
//
// Phase 5: one-off backfill for existing seed data (~5000 rows from
// load.sh) that predates the Phase 4 ingestion worker.
//
// Run with the worker already running in another terminal:
//   Terminal 1: npx tsx scripts/start-ingestion-worker.ts
//   Terminal 2: npx tsx scripts/backfill-search-index.ts
//
// This script only ENQUEUES jobs — it doesn't wait for them to finish.
// The worker (already running, concurrency: 2) processes them in the
// background at its own pace. Re-running this script is safe: it only
// picks up rows where embedding IS NULL, so already-processed rows are
// skipped automatically.

import { prisma } from "../lib/prisma";
import { enqueueArtistIngestion } from "../lib/queues/ingestion-queue";

const BATCH_SIZE = 200;

async function main() {
  // embedding is Unsupported("vector") in Prisma — can't filter on it via
  // the normal client API, so this goes through $queryRaw instead.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM artist_profiles WHERE embedding IS NULL
  `;

  console.log(`Found ${rows.length} profiles needing backfill.`);

  if (rows.length === 0) {
    console.log("Nothing to do — all profiles already indexed.");
    return;
  }

  let enqueued = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((row) => enqueueArtistIngestion(row.id)));
    enqueued += batch.length;
    console.log(`Enqueued ${enqueued}/${rows.length}...`);
  }

  console.log(
    `\nDone enqueuing ${enqueued} jobs. The worker will process them in the ` +
      `background — watch its terminal for progress, or re-run this script ` +
      `later to check how many still remain.`
  );
}

main()
  .catch((err) => {
    console.error("Backfill script failed:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });