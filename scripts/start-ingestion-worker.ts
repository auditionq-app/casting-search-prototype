// scripts/start-ingestion-worker.ts
//
// Run this in its own terminal (separate from `npm run dev`) whenever you
// want the ingestion worker actively processing jobs:
//
//   npx tsx scripts/start-ingestion-worker.ts
//
// Leave it running — it listens on the queue continuously.

import { startIngestionWorker } from "../workers/ingestion-worker";

console.log("Starting artist ingestion worker...");
const worker = startIngestionWorker();

process.on("SIGINT", async () => {
  console.log("Shutting down ingestion worker...");
  await worker.close();
  process.exit(0);
});