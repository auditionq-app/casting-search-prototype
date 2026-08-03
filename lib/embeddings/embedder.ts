// lib/embeddings/embedder.ts

import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

const MODEL_NAME = "Xenova/bge-small-en-v1.5";

// The pipeline load is slow (downloads/loads the model into memory), so
// we cache it as a module-level singleton — only load it once per process,
// not once per embed() call.
let embedderPromise: Promise<FeatureExtractionPipeline> | null = null;

function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedderPromise) {
    embedderPromise = pipeline(
      "feature-extraction",
      MODEL_NAME
    ) as Promise<FeatureExtractionPipeline>;
  }
  return embedderPromise;
}

// Returns a 384-dim embedding, mean-pooled and normalized — matching what
// the artist_profiles.embedding column (vector(384)) expects, and matching
// bge's recommended usage (mean pooling + L2 normalization).
export async function embedText(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}