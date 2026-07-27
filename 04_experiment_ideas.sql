-- Starter experiments for director applicant search R&D.
-- Apply one approach at a time; re-run 03_baseline_queries.sql and compare.

-- A) Covering / composite indexes for filtered rank
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apps_cc_match_submitted
--   ON applications (casting_call_id, matching_percentage DESC, submitted_at DESC)
--   WHERE withdrawn_at IS NULL;
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apps_cc_status_match
--   ON applications (casting_call_id, status, matching_percentage DESC);

-- B) Name search: trigram on artist full_name
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artist_full_name_trgm
--   ON artist_profiles USING gin (full_name gin_trgm_ops);
-- -- then: WHERE ap.full_name ILIKE '%sharma%'

-- C) Generated age years (avoid repeating age() expression)
-- ALTER TABLE artist_profiles ADD COLUMN IF NOT EXISTS age_years int
--   GENERATED ALWAYS AS (
--     FLOOR(date_part('year', age(CURRENT_DATE, date_of_birth::date)))::int
--   ) STORED;
-- CREATE INDEX IF NOT EXISTS idx_artist_age_years ON artist_profiles (age_years)
--   WHERE date_of_birth IS NOT NULL;

-- D) Location trigram
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artist_location_trgm
--   ON artist_profiles USING gin (current_location gin_trgm_ops);

-- E) Materialized / denormalized applicant search document per application
-- ALTER TABLE applications ADD COLUMN IF NOT EXISTS talent_search_document text;
-- ALTER TABLE applications ADD COLUMN IF NOT EXISTS talent_search_tsv tsvector;
-- UPDATE applications a SET
--   talent_search_document = LOWER(CONCAT_WS(' ',
--     ap.full_name, ap.bio, ap.current_location, ap.state, ap.primary_language,
--     ap.primary_category::text, ap.experience_level::text,
--     CAST(ap.specializations AS text), CAST(ap.language_preferences AS text)
--   )),
--   talent_search_tsv = to_tsvector('simple', COALESCE(LOWER(CONCAT_WS(' ',
--     ap.full_name, ap.bio, ap.current_location, ap.state, ap.primary_language,
--     ap.primary_category::text, ap.experience_level::text,
--     CAST(ap.specializations AS text), CAST(ap.language_preferences AS text)
--   ), ''))
-- )
-- FROM artist_profiles ap WHERE ap.id = a.artist_id;
-- CREATE INDEX IF NOT EXISTS idx_apps_talent_search_tsv ON applications USING gin (talent_search_tsv);

-- F) Keep SQL pagination for "grouped" views (avoid loading all rows into app memory)
--    — redesign query to GROUP BY artist_id / DISTINCT ON in SQL with LIMIT/OFFSET.

-- G) Partial indexes for shortlisted / high matches
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apps_cc_high_match
--   ON applications (casting_call_id, matching_percentage DESC)
--   WHERE matching_percentage >= 70 AND withdrawn_at IS NULL;
