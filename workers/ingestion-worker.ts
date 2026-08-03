// workers/ingestion-worker.ts

import { Worker, type Job } from "bullmq";
import { createRedisConnection } from "../lib/redis/connection";
import { INGESTION_QUEUE_NAME, type IngestionJobData } from "../lib/queues/ingestion-queue";
import { prisma } from "../lib/prisma";
import { buildSearchDocument } from "../lib/search-document/build-search-document";
import { embedText } from "../lib/embeddings/embedder";

async function processArtistIngestion(job: Job<IngestionJobData>) {
  const { artistId } = job.data;

  const profile = await prisma.artist_profiles.findUnique({
    where: { id: artistId },
  });

  if (!profile) {
    throw new Error(`artist_profiles row not found for id ${artistId}`);
  }

  const searchDocument = buildSearchDocument({
    full_name: profile.full_name,
    bio: profile.bio,
    primary_category: profile.primary_category,
    experience_level: profile.experience_level,
    years_of_experience: profile.years_of_experience,
    skin_tone: profile.skin_tone,
    eye_color: profile.eye_color,
    hair_color: profile.hair_color,
    build: profile.build,
    current_location: profile.current_location,
    state: profile.state,
    country: profile.country,
    primary_language: profile.primary_language,
    specializations: profile.specializations,
    genre_preferences: profile.genre_preferences,
    ethnicity: profile.ethnicity,
    filmography: profile.filmography,
    awards: profile.awards,
    portfolio: profile.portfolio,
    language_preferences: profile.language_preferences,
  });

  const embedding = await embedText(searchDocument);

  // embedding column is Unsupported("vector") in Prisma — can't go through
  // the normal update() API. Write both fields together via raw SQL so the
  // row update is atomic. pgvector accepts a '[0.1,0.2,...]' text literal
  // cast to ::vector.
  const vectorLiteral = `[${embedding.join(",")}]`;

  await prisma.$executeRaw`
    UPDATE artist_profiles
    SET search_document = ${searchDocument},
        embedding = ${vectorLiteral}::vector
    WHERE id = ${artistId}::uuid
  `;

  return { artistId, documentLength: searchDocument.length, embeddingDims: embedding.length };
}

export function startIngestionWorker() {
  const worker = new Worker<IngestionJobData>(
    INGESTION_QUEUE_NAME,
    processArtistIngestion,
    {
      connection: createRedisConnection(),
      concurrency: 2, // conservative given laptop's 2GB VRAM / CPU-only VPS target
    }
  );

  worker.on("completed", (job, result) => {
    console.log(`[ingestion-worker] completed job ${job.id}:`, result);
  });

  worker.on("failed", (job, err) => {
    console.error(`[ingestion-worker] job ${job?.id} failed:`, err);
  });

  return worker;
}