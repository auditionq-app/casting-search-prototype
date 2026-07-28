-- Baseline queries: director browsing / filtering applicants on one casting call.
-- Fixed casting_call_id from seed: a0000000-0000-4000-8000-000000000003

\timing on
\set cc_id 'a0000000-0000-4000-8000-000000000003'

-- 1) Rank by match % with pagination (flat list path)
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  a.id,
  a.matching_percentage,
  a.status,
  a.role_title,
  a.submitted_at,
  ap.full_name,
  ap.gender,
  ap.current_location,
  ap.primary_category,
  ap.experience_level
FROM applications a
JOIN artist_profiles ap ON ap.id = a.artist_id
JOIN users u ON u.id = ap.user_id
WHERE a.casting_call_id = :'cc_id'::uuid
  AND a.withdrawn_at IS NULL
  AND (u.suspended_at IS NULL)
  AND (u.deactivated_at IS NULL)
  AND (u.scheduled_deletion_at IS NULL)
  AND a.matching_percentage BETWEEN 0 AND 100
ORDER BY a.matching_percentage DESC, a.submitted_at DESC
LIMIT 50 OFFSET 0;

-- 2) Filtered: gender + skills + languages + min match (common director filters)
EXPLAIN (ANALYZE, BUFFERS)
SELECT a.id, a.matching_percentage, ap.full_name, ap.specializations, ap.language_preferences
FROM applications a
JOIN artist_profiles ap ON ap.id = a.artist_id
JOIN users u ON u.id = ap.user_id
WHERE a.casting_call_id = :'cc_id'::uuid
  AND a.withdrawn_at IS NULL
  AND u.suspended_at IS NULL
  AND u.deactivated_at IS NULL
  AND a.matching_percentage >= 70
  AND ap.gender IN ('Male', 'Female')
  AND (
    ap.specializations @> '["Acting"]'::jsonb
    OR ap.primary_category::text = 'Actor'
  )
  AND ap.language_preferences @> '["Hindi"]'::jsonb
ORDER BY a.matching_percentage DESC, a.submitted_at DESC
LIMIT 50;

-- 3) Age range + location substring (expression + LIKE — often expensive)
EXPLAIN (ANALYZE, BUFFERS)
SELECT a.id, a.matching_percentage, ap.full_name, ap.date_of_birth, ap.current_location
FROM applications a
JOIN artist_profiles ap ON ap.id = a.artist_id
WHERE a.casting_call_id = :'cc_id'::uuid
  AND a.matching_percentage >= 60
  AND ap.date_of_birth IS NOT NULL
  AND FLOOR(date_part('year', age(CURRENT_DATE, ap.date_of_birth::date))) BETWEEN 22 AND 35
  AND (
    LOWER(COALESCE(ap.current_location, '')) LIKE LOWER('%Mumbai%')
    OR LOWER(COALESCE(ap.state, '')) LIKE LOWER('%Mumbai%')
  )
ORDER BY a.matching_percentage DESC
LIMIT 50;

-- 4) Full filtered set without LIMIT (grouped UI path loads all, then sorts in app)
EXPLAIN (ANALYZE, BUFFERS)
SELECT a.id, a.artist_id, a.matching_percentage, a.role_id, a.submitted_at
FROM applications a
JOIN artist_profiles ap ON ap.id = a.artist_id
JOIN users u ON u.id = ap.user_id
WHERE a.casting_call_id = :'cc_id'::uuid
  AND a.withdrawn_at IS NULL
  AND u.suspended_at IS NULL
  AND a.matching_percentage BETWEEN 0 AND 100
ORDER BY a.matching_percentage DESC;

-- 5) Name search (not in production SQL today — candidate for R&D)
EXPLAIN (ANALYZE, BUFFERS)
SELECT a.id, a.matching_percentage, ap.full_name
FROM applications a
JOIN artist_profiles ap ON ap.id = a.artist_id
WHERE a.casting_call_id = :'cc_id'::uuid
  AND LOWER(ap.full_name) LIKE LOWER('%sharma%')
ORDER BY a.matching_percentage DESC
LIMIT 50;

-- Sanity counts
SELECT count(*) AS applications FROM applications WHERE casting_call_id = :'cc_id'::uuid;
SELECT
  width_bucket(matching_percentage, 0, 100, 10) AS bucket,
  count(*)
FROM applications
WHERE casting_call_id = :'cc_id'::uuid
GROUP BY 1
ORDER BY 1;
