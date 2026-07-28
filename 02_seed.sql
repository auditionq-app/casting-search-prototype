-- Seed 1 casting call + N talent applications (default 5000).
-- Override:  psql ... -v seed_count=10000 -f 02_seed.sql
--
-- Fixed casting_call_id for baseline queries:
--   a0000000-0000-4000-8000-000000000003

\if :{?seed_count}
\else
\set seed_count 5000
\endif

TRUNCATE role_match_scores, applications, casting_calls, artist_profiles, director_profiles, users
  RESTART IDENTITY CASCADE;

INSERT INTO users (id, email, user_type) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'rd-director@example.test', 'director');

INSERT INTO director_profiles (id, user_id, full_name, company_name, city)
VALUES (
  'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000001',
  'RD Casting Director',
  'Lotus Casting House',
  'Mumbai'
);

INSERT INTO casting_calls (
  id, director_id, title, movie_name, project_type, description,
  genre, languages, requirements, roles, status, is_active, published_at,
  application_deadline, application_count
) VALUES (
  'a0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000002',
  'Lead & Supporting Cast — Neon Dreams',
  'Neon Dreams',
  'Feature Film',
  'Feature film casting in Mumbai. Looking for lead and supporting actors.',
  '["Drama","Thriller"]'::json,
  '["Hindi","English"]'::json,
  '{"location":"Mumbai","skills":["Acting","Improvisation"],"ageRange":{"min":20,"max":40}}'::json,
  '[
    {
      "id": "b0000000-0000-4000-8000-000000000001",
      "title": "Lead Actor",
      "description": "Protagonist, strong screen presence",
      "requirements": {
        "gender": ["Male", "Female"],
        "ageRange": {"min": 22, "max": 35},
        "location": "Mumbai",
        "skills": ["Acting", "Improvisation"],
        "languages": ["Hindi", "English"]
      },
      "spotsAvailable": 1,
      "priority": 1
    },
    {
      "id": "b0000000-0000-4000-8000-000000000002",
      "title": "Supporting Role",
      "description": "Best friend / foil",
      "requirements": {
        "gender": ["Male", "Female"],
        "ageRange": {"min": 20, "max": 45},
        "location": "Mumbai",
        "skills": ["Acting"],
        "languages": ["Hindi"]
      },
      "spotsAvailable": 2,
      "priority": 2
    }
  ]'::json,
  'published',
  true,
  now() - interval '10 days',
  now() + interval '30 days',
  0
);

WITH params AS (
  SELECT :seed_count::int AS n
),
gen AS (
  SELECT gs AS i
  FROM params
  CROSS JOIN generate_series(1, params.n) AS gs
),
ins_users AS (
  INSERT INTO users (id, email, user_type)
  SELECT gen_random_uuid(), 'rd-talent' || g.i || '@example.test', 'artist'
  FROM gen g
  RETURNING id, email
),
numbered_users AS (
  SELECT id, email, row_number() OVER (ORDER BY email) AS i
  FROM ins_users
),
ins_artists AS (
  INSERT INTO artist_profiles (
    id, user_id, full_name, date_of_birth, gender, height, weight, build,
    current_location, state, country, language_preferences, primary_language,
    experience_level, years_of_experience, primary_category, specializations,
    bio, profile_completion, is_active, available_locations, genre_preferences
  )
  SELECT
    gen_random_uuid(),
    nu.id,
    (ARRAY[
      'Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Ayaan','Krishna','Ishaan',
      'Ananya','Aadhya','Pari','Anika','Navya','Diya','Myra','Sara','Aanya','Ira'
    ])[1 + ((nu.i - 1) % 20)]
    || ' '
    || (ARRAY['Sharma','Patel','Singh','Reddy','Nair','Iyer','Khan','Mehta','Gupta','Das'])[1 + ((nu.i / 20) % 10)],
    (CURRENT_DATE - ((18 + ((nu.i - 1) % 35))::text || ' years')::interval
      - ((nu.i % 200)::text || ' days')::interval)::date,
    (ARRAY['Male','Female','Male','Female','Non-binary'])[1 + ((nu.i - 1) % 5)]::artist_profiles_gender_enum,
    155 + ((nu.i - 1) % 40),
    50 + ((nu.i - 1) % 45),
    (ARRAY['Slim','Average','Athletic','Muscular','Plus-size','Petite'])[1 + ((nu.i - 1) % 6)]::artist_profiles_build_enum,
    (ARRAY['Mumbai','Delhi','Bangalore','Hyderabad','Chennai','Pune','Kolkata','Jaipur'])[1 + ((nu.i - 1) % 8)],
    (ARRAY['Maharashtra','Delhi','Karnataka','Telangana','Tamil Nadu','Maharashtra','West Bengal','Rajasthan'])[1 + ((nu.i - 1) % 8)],
    'India',
    (
      ARRAY[
        '["Hindi"]'::jsonb,
        '["Hindi","English"]'::jsonb,
        '["Tamil","English"]'::jsonb,
        '["Telugu"]'::jsonb,
        '["Marathi","Hindi"]'::jsonb,
        '["English"]'::jsonb,
        '["Bengali","Hindi"]'::jsonb,
        '["Kannada","English"]'::jsonb
      ]
    )[1 + ((nu.i - 1) % 8)],
    (ARRAY['Hindi','English','Tamil','Telugu','Marathi'])[1 + ((nu.i - 1) % 5)],
    (ARRAY['Beginner','Intermediate','Professional','Expert','Veteran'])[1 + ((nu.i - 1) % 5)]::artist_profiles_experience_level_enum,
    1 + ((nu.i - 1) % 20),
    (ARRAY['Actor','Singer','Dancer','Model','Voice Artist','Actor','Actor'])[1 + ((nu.i - 1) % 7)]::artist_profiles_primary_category_enum,
    (
      ARRAY[
        '["Acting","Improvisation"]'::jsonb,
        '["Acting","Comedy Timing"]'::jsonb,
        '["Dancing","Classical Dance"]'::jsonb,
        '["Acting","Combat"]'::jsonb,
        '["Singing","Acting"]'::jsonb,
        '["Method Acting"]'::jsonb,
        '["Acting","Accent Work"]'::jsonb,
        '["Stunts","Acting"]'::jsonb
      ]
    )[1 + ((nu.i - 1) % 8)],
    'Professional talent based in India. Portfolio includes stage and screen work. Profile #' || nu.i,
    40 + ((nu.i - 1) % 60),
    true,
    jsonb_build_array(
      (ARRAY['Mumbai','Delhi','Bangalore','Hyderabad','Chennai','Pune','Kolkata','Jaipur'])[1 + ((nu.i - 1) % 8)]
    ),
    (
      ARRAY[
        '["Drama"]'::jsonb,
        '["Comedy","Romance"]'::jsonb,
        '["Action","Thriller"]'::jsonb,
        '["Drama","Thriller"]'::jsonb
      ]
    )[1 + ((nu.i - 1) % 4)]
  FROM numbered_users nu
  RETURNING id, full_name
),
numbered_artists AS (
  SELECT id, full_name, row_number() OVER (ORDER BY full_name, id) AS i
  FROM ins_artists
)
INSERT INTO applications (
  casting_call_id, artist_id, director_id, role_id, role_title,
  submitted_at, source, matching_percentage, matching_details,
  matching_last_updated, original_matching_percentage, status, is_shortlisted, rating
)
SELECT
  'a0000000-0000-4000-8000-000000000003'::uuid,
  a.id,
  'a0000000-0000-4000-8000-000000000002'::uuid,
  CASE
    WHEN a.i % 3 = 0 THEN 'b0000000-0000-4000-8000-000000000002'::uuid
    ELSE 'b0000000-0000-4000-8000-000000000001'::uuid
  END,
  CASE WHEN a.i % 3 = 0 THEN 'Supporting Role' ELSE 'Lead Actor' END,
  now() - ((a.i % 14) || ' days')::interval - ((a.i % 24) || ' hours')::interval,
  (ARRAY['Direct Link','Landing Page','QR Code','Notification'])[1 + ((a.i - 1) % 4)]::applications_source_enum,
  LEAST(100, GREATEST(5,
    (ARRAY[35,42,48,55,58,62,65,68,72,75,78,82,85,88,92,95])[1 + ((a.i * 7) % 16)]
    + ((a.i * 3) % 7) - 3
  )),
  json_build_object(
    'overall', LEAST(100, GREATEST(5, 50 + ((a.i * 3) % 45))),
    'genderMatch', 60 + ((a.i) % 40),
    'ageMatch', 50 + ((a.i * 2) % 50),
    'skillsMatch', 40 + ((a.i * 5) % 60),
    'languageMatch', 50 + ((a.i * 3) % 50),
    'experienceMatch', 40 + ((a.i) % 55),
    'appearanceMatch', 45 + ((a.i * 4) % 50),
    'locationMatch', 30 + ((a.i * 6) % 70),
    'version', 1,
    'lastCalculatedAt', now()::text
  ),
  now() - ((a.i % 5) || ' days')::interval,
  LEAST(100, GREATEST(5, 50 + ((a.i * 3) % 45))),
  (ARRAY['Submitted','Submitted','Submitted','Viewed','Shortlisted','Rejected'])[1 + ((a.i - 1) % 6)]::applications_status_enum,
  (a.i % 17 = 0),
  CASE WHEN a.i % 11 = 0 THEN round((3.0 + (a.i % 20) / 10.0)::numeric, 2) ELSE NULL END
FROM numbered_artists a;

INSERT INTO role_match_scores (
  artist_id, casting_call_id, role_id, matching_percentage, matching_details, calculated_at
)
SELECT
  ap.artist_id,
  ap.casting_call_id,
  ap.role_id,
  ap.matching_percentage,
  ap.matching_details,
  COALESCE(ap.matching_last_updated, now())
FROM applications ap
WHERE ap.role_id IS NOT NULL;

UPDATE casting_calls
SET application_count = (
  SELECT count(*)::int FROM applications
  WHERE casting_call_id = 'a0000000-0000-4000-8000-000000000003'
)
WHERE id = 'a0000000-0000-4000-8000-000000000003';

SELECT
  (SELECT count(*) FROM artist_profiles) AS talents,
  (SELECT count(*) FROM applications) AS applications,
  (SELECT count(*) FROM role_match_scores) AS role_match_scores,
  'a0000000-0000-4000-8000-000000000003' AS casting_call_id;
