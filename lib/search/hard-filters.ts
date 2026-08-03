// lib/search/hard-filters.ts

import { Prisma } from "../../app/generated/prisma/client";
import type { HardFilters } from "../query-understanding/types";

// Query-understanding outputs lowercase gender strings ("male", "female"),
// but artist_profiles_gender_enum uses capitalized/underscored labels.
// Anything unrecognized is intentionally left unmapped (filter skipped for
// that field) rather than throwing — a 1.5B model could produce an
// unexpected string, and failing the whole search over one bad enum guess
// would be worse than just not filtering on it.
const GENDER_MAP: Record<string, string> = {
  male: "Male",
  man: "Male",
  female: "Female",
  woman: "Female",
  "non-binary": "Non_binary",
  nonbinary: "Non_binary",
  "non_binary": "Non_binary",
  other: "Other",
};

function mapGender(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return GENDER_MAP[raw.trim().toLowerCase()];
}

// Converts an age range into date_of_birth cutoff conditions, computed via
// Postgres's own interval arithmetic (CURRENT_DATE - INTERVAL 'N years')
// rather than approximating in JavaScript. Deliberately NOT using
// AGE(date_of_birth) here: that wraps the column in a function, which
// prevents Postgres from using the B-tree index on date_of_birth for a
// range scan (non-sargable). Instead we compute the cutoff dates and
// compare the column directly, unwrapped — same accurate date math,
// still index-friendly.
function ageRangeToDobConditions(
  ageMin: number | undefined,
  ageMax: number | undefined
): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  // age >= age_min  <=>  date_of_birth <= CURRENT_DATE - INTERVAL 'age_min years'
  if (ageMin != null) {
    conditions.push(
      Prisma.sql`date_of_birth <= CURRENT_DATE - (${ageMin}::text || ' years')::interval`
    );
  }

  // age <= age_max  <=>  date_of_birth > CURRENT_DATE - INTERVAL '(age_max+1) years'
  if (ageMax != null) {
    conditions.push(
      Prisma.sql`date_of_birth > CURRENT_DATE - (${ageMax + 1}::text || ' years')::interval`
    );
  }

  return conditions;
}

// Builds the AND-joined WHERE conditions for hard_filters. Always includes
// is_active = true, matching the partial indexes from Phase 1
// (idx_artist_profiles_gender_age, idx_artist_profiles_age_years) which are
// scoped `where is_active = true` / `where date_of_birth is not null`.
export function buildHardFilterConditions(filters: HardFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`is_active = true`];

  const mappedGender = mapGender(filters.gender);
  if (mappedGender) {
    conditions.push(Prisma.sql`gender = ${mappedGender}::"artist_profiles_gender_enum"`);
  }

  const ageConditions = ageRangeToDobConditions(filters.age_min, filters.age_max);
  conditions.push(...ageConditions);

  if (filters.languages && filters.languages.length > 0) {
    // Match if primary_language equals any requested language (case-insensitive)
    // OR language_preferences (jsonb array) contains any of them.
    const langConditions = filters.languages.map(
      (lang) => Prisma.sql`
        (
          lower(primary_language) = lower(${lang})
          OR language_preferences @> ${JSON.stringify([lang])}::jsonb
        )
      `
    );
    conditions.push(Prisma.sql`(${Prisma.join(langConditions, " OR ")})`);
  }

  return Prisma.join(conditions, " AND ");
}