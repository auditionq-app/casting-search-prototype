// src/lib/query-understanding/haiku-provider.ts

import type {
  QueryUnderstandingProvider,
  QueryUnderstandingResult,
} from "./types";

// Stub only, per AGENT-LOCAL.md Phase 3 — no paid API calls in this phase.
// The interface must exist so QUERY_PROVIDER=haiku is a config flip later,
// not a rewrite. Real implementation comes when the project moves off
// fully-local models.
export class HaikuQueryUnderstandingProvider
  implements QueryUnderstandingProvider
{
  async parse(_query: string): Promise<QueryUnderstandingResult> {
    throw new Error(
      "HaikuQueryUnderstandingProvider is not implemented yet. " +
        "Set QUERY_PROVIDER=local to use the local Qwen provider."
    );
  }
}