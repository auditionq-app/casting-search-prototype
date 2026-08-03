// lib/search-document/build-search-document.ts

// Builds the plain-text `search_document` for an artist_profiles row.
// This text is what gets embedded (bge-small) and full-text-indexed
// (search_tsv, which Postgres derives automatically from this column —
// we never write to search_tsv directly).
//
// Field choices below are based on the actual artist_profiles Prisma
// schema. Any Json field's shape isn't strictly defined by the schema,
// so we flatten defensively rather than assuming a fixed structure.

interface ArtistProfileForIndexing {
  full_name: string;
  bio: string | null;
  primary_category: string | null;
  experience_level: string | null;
  years_of_experience: number | null;
  skin_tone: string | null;
  eye_color: string | null;
  hair_color: string | null;
  build: string | null;
  current_location: string | null;
  state: string | null;
  country: string | null;
  primary_language: string | null;
  specializations: unknown;
  genre_preferences: unknown;
  ethnicity: unknown;
  filmography: unknown;
  awards: unknown;
  portfolio: unknown;
  language_preferences: unknown;
}

// Flattens an arbitrary JSON value into space-joined text, picking up
// strings/numbers wherever they appear (arrays of strings, arrays of
// objects with string fields, etc.) without assuming one fixed shape.
function flattenJsonToText(value: unknown, depth = 0): string[] {
  if (value == null || depth > 4) return [];

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((v) => flattenJsonToText(v, depth + 1));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((v) =>
      flattenJsonToText(v, depth + 1)
    );
  }

  return [];
}

export function buildSearchDocument(profile: ArtistProfileForIndexing): string {
  const parts: string[] = [];

  parts.push(profile.full_name);

  if (profile.bio) parts.push(profile.bio);

  if (profile.primary_category) parts.push(profile.primary_category);
  if (profile.experience_level) parts.push(profile.experience_level);
  if (profile.years_of_experience != null) {
    parts.push(`${profile.years_of_experience} years of experience`);
  }

  if (profile.skin_tone) parts.push(`${profile.skin_tone} skin`);
  if (profile.eye_color) parts.push(`${profile.eye_color} eyes`);
  if (profile.hair_color) parts.push(`${profile.hair_color} hair`);
  if (profile.build) parts.push(`${profile.build} build`);

  if (profile.current_location) parts.push(profile.current_location);
  if (profile.state) parts.push(profile.state);
  if (profile.country) parts.push(profile.country);
  if (profile.primary_language) parts.push(profile.primary_language);

  parts.push(...flattenJsonToText(profile.specializations));
  parts.push(...flattenJsonToText(profile.genre_preferences));
  parts.push(...flattenJsonToText(profile.ethnicity));
  parts.push(...flattenJsonToText(profile.filmography));
  parts.push(...flattenJsonToText(profile.awards));
  parts.push(...flattenJsonToText(profile.portfolio));
  parts.push(...flattenJsonToText(profile.language_preferences));

  return parts.filter(Boolean).join(". ");
}