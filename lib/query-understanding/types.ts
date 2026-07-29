// src/lib/query-understanding/types.ts

export interface HardFilters {
  gender?: string;
  age_min?: number;
  age_max?: number;
  languages?: string[];
}

export interface SoftPreferences {
  traits?: string[];
}

export interface QueryUnderstandingResult {
  hard_filters: HardFilters;
  soft_preferences: SoftPreferences;
  semantic_query: string;
}

export interface QueryUnderstandingProvider {
  parse(query: string): Promise<QueryUnderstandingResult>;
}