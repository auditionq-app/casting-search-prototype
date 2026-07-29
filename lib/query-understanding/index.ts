// src/lib/query-understanding/index.ts

import type { QueryUnderstandingProvider } from "./types";
import { LocalQueryUnderstandingProvider } from "./local-provider";
import { HaikuQueryUnderstandingProvider } from "./haiku-provider";

export type { QueryUnderstandingProvider, QueryUnderstandingResult, HardFilters, SoftPreferences } from "./types";

// This is the single switch point mentioned in AGENT-LOCAL.md:
// QUERY_PROVIDER=local|haiku in .env picks the implementation.
// Nothing else in the app should import LocalQueryUnderstandingProvider
// or HaikuQueryUnderstandingProvider directly — always go through this.
export function getQueryUnderstandingProvider(): QueryUnderstandingProvider {
  const provider = process.env.QUERY_PROVIDER ?? "local";

  switch (provider) {
    case "local":
      return new LocalQueryUnderstandingProvider();
    case "haiku":
      return new HaikuQueryUnderstandingProvider();
    default:
      throw new Error(
        `Unknown QUERY_PROVIDER "${provider}". Expected "local" or "haiku".`
      );
  }
}