// lib/queues/ingestion-queue.ts

import { Queue } from "bullmq";
import { createRedisConnection } from "../redis/connection";

export const INGESTION_QUEUE_NAME = "artist-ingestion";

export interface IngestionJobData {
  artistId: string;
}

// Singleton queue instance — same reasoning as the Prisma singleton:
// avoid creating a new Redis connection every time this module is imported.
let queueInstance: Queue<IngestionJobData> | null = null;

function getQueue(): Queue<IngestionJobData> {
  if (!queueInstance) {
    queueInstance = new Queue<IngestionJobData>(INGESTION_QUEUE_NAME, {
      connection: createRedisConnection(),
    });
  }
  return queueInstance;
}

// This is the function any create/update flow should call — whether that's
// this prototype's manual test route, the Phase 5 backfill script, or (later,
// once merged into the real app) the actual profile save endpoint.
export async function enqueueArtistIngestion(artistId: string) {
  const queue = getQueue();
  return queue.add(
    "reindex-artist",
    { artistId },
    {
      // Basic retry policy — a transient Ollama/embedding failure shouldn't
      // permanently skip a profile.
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 100, // keep last 100 failures for debugging
    }
  );
}