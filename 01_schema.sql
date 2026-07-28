-- Director applicant / talent search R&D — realistic schema (PostgreSQL 15+)
-- Focus: thousands of applications per casting call; filter + rank by match %.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

DROP TABLE IF EXISTS role_match_scores CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS casting_calls CASCADE;
DROP TABLE IF EXISTS artist_profiles CASCADE;
DROP TABLE IF EXISTS director_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS applications_status_enum CASCADE;
DROP TYPE IF EXISTS applications_source_enum CASCADE;
DROP TYPE IF EXISTS artist_profiles_gender_enum CASCADE;
DROP TYPE IF EXISTS artist_profiles_build_enum CASCADE;
DROP TYPE IF EXISTS artist_profiles_experience_level_enum CASCADE;
DROP TYPE IF EXISTS artist_profiles_primary_category_enum CASCADE;
DROP TYPE IF EXISTS casting_calls_status_enum CASCADE;

CREATE TYPE applications_status_enum AS ENUM (
  'Submitted', 'Viewed', 'Shortlisted', 'Rejected', 'Selected'
);
CREATE TYPE applications_source_enum AS ENUM (
  'Landing Page', 'QR Code', 'Direct Link', 'Notification'
);
CREATE TYPE artist_profiles_gender_enum AS ENUM (
  'Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'
);
CREATE TYPE artist_profiles_build_enum AS ENUM (
  'Slim', 'Average', 'Athletic', 'Muscular', 'Plus-size', 'Petite'
);
CREATE TYPE artist_profiles_experience_level_enum AS ENUM (
  'Beginner', 'Intermediate', 'Professional', 'Expert', 'Veteran'
);
CREATE TYPE artist_profiles_primary_category_enum AS ENUM (
  'Actor', 'Singer', 'Dancer', 'Model', 'Voice Artist', 'Writer',
  'Director', 'Photographer', 'Camera Crew', 'Editor', 'Other'
);
CREATE TYPE casting_calls_status_enum AS ENUM ('draft', 'published', 'closed', 'cancelled');

CREATE TABLE users (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                   varchar(255) NOT NULL UNIQUE,
  user_type               varchar(32) NOT NULL,
  is_verified             boolean NOT NULL DEFAULT true,
  suspended_at            timestamp without time zone,
  deactivated_at          timestamp without time zone,
  scheduled_deletion_at   timestamp without time zone,
  created_at              timestamp without time zone NOT NULL DEFAULT now(),
  updated_at              timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE director_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES users(id),
  full_name       varchar(255),
  company_name    varchar(255),
  city            varchar(100),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE artist_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES users(id),
  full_name             varchar(255) NOT NULL,
  date_of_birth         date,
  gender                artist_profiles_gender_enum,
  height                integer,
  weight                integer,
  build                 artist_profiles_build_enum,
  skin_tone             varchar(50),
  eye_color             varchar(50),
  hair_color            varchar(50),
  ethnicity             json,
  current_location      varchar(100),
  state                 varchar(100),
  country               varchar(100),
  available_locations   jsonb,
  genre_preferences     jsonb,
  language_preferences  jsonb,
  primary_language      varchar(100),
  experience_level      artist_profiles_experience_level_enum,
  years_of_experience   integer,
  primary_category      artist_profiles_primary_category_enum,
  specializations       jsonb,
  bio                   text,
  filmography           json,
  awards                json,
  portfolio             json,
  profile_completion    integer NOT NULL DEFAULT 0,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamp without time zone NOT NULL DEFAULT now(),
  updated_at            timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX "IDX_artist_profiles_user_id" ON artist_profiles (user_id);
CREATE INDEX idx_artist_profiles_gender_age
  ON artist_profiles (gender, date_of_birth) WHERE is_active = true;
CREATE INDEX idx_artist_profiles_completion
  ON artist_profiles (profile_completion, is_active);
CREATE INDEX idx_artist_profiles_languages
  ON artist_profiles USING gin (language_preferences);
CREATE INDEX idx_artist_profiles_specializations
  ON artist_profiles USING gin (specializations);
CREATE INDEX idx_artist_profiles_available_locations
  ON artist_profiles USING gin (available_locations);
CREATE INDEX idx_artist_profiles_genre_preferences
  ON artist_profiles USING gin (genre_preferences);

CREATE TABLE casting_calls (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  director_id           uuid NOT NULL REFERENCES director_profiles(id),
  title                 varchar(200) NOT NULL,
  movie_name            varchar(200),
  project_type          varchar(100),
  description           text,
  genre                 json,
  languages             json,
  requirements          json,
  roles                 json,
  status                casting_calls_status_enum NOT NULL DEFAULT 'published',
  is_active             boolean NOT NULL DEFAULT true,
  published_at          timestamp without time zone,
  application_deadline  timestamp without time zone NOT NULL,
  application_count     integer NOT NULL DEFAULT 0,
  created_at            timestamp without time zone NOT NULL DEFAULT now(),
  deleted_at            timestamp without time zone,
  suspended_at          timestamp without time zone
);

CREATE TABLE applications (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casting_call_id           uuid NOT NULL REFERENCES casting_calls(id),
  artist_id                 uuid NOT NULL REFERENCES artist_profiles(id),
  director_id               uuid NOT NULL REFERENCES director_profiles(id),
  role_id                   uuid,
  role_title                varchar(200),
  submitted_at              timestamp without time zone NOT NULL DEFAULT now(),
  source                    applications_source_enum NOT NULL DEFAULT 'Direct Link',
  matching_percentage       integer NOT NULL DEFAULT 0,
  matching_details          json,
  matching_last_updated     timestamp without time zone,
  original_matching_percentage integer,
  status                    applications_status_enum NOT NULL DEFAULT 'Submitted',
  status_history            json,
  director_notes            text,
  rating                    numeric(3, 2),
  is_shortlisted            boolean NOT NULL DEFAULT false,
  shortlisted_at            timestamp without time zone,
  created_at                timestamp without time zone NOT NULL DEFAULT now(),
  updated_at                timestamp without time zone NOT NULL DEFAULT now(),
  withdrawn_at              timestamp without time zone,
  withdrawal_reason         varchar,
  CONSTRAINT uq_applications_call_artist_role UNIQUE (casting_call_id, artist_id, role_id)
);

CREATE INDEX "IDX_applications_casting_call_id" ON applications (casting_call_id);
CREATE INDEX "IDX_applications_artist_id" ON applications (artist_id);
CREATE INDEX "IDX_applications_status" ON applications (status);
CREATE INDEX "IDX_applications_submitted_at" ON applications (submitted_at);
CREATE INDEX "IDX_applications_role_id" ON applications (role_id);
CREATE INDEX idx_applications_casting_status_submitted
  ON applications (casting_call_id, status, submitted_at DESC);
CREATE INDEX idx_applications_director_status
  ON applications (director_id, status, submitted_at DESC);
CREATE INDEX idx_applications_matching_percentage
  ON applications (casting_call_id, matching_percentage DESC);

CREATE TABLE role_match_scores (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id             uuid NOT NULL REFERENCES artist_profiles(id),
  casting_call_id       uuid NOT NULL REFERENCES casting_calls(id),
  role_id               uuid NOT NULL,
  matching_percentage   integer NOT NULL DEFAULT 0,
  matching_details      json,
  calculated_at         timestamp without time zone NOT NULL DEFAULT now(),
  artist_profile_version timestamp without time zone,
  CONSTRAINT uq_role_match_artist_call_role UNIQUE (artist_id, casting_call_id, role_id)
);

CREATE INDEX "IDX_role_match_scores_artist_id" ON role_match_scores (artist_id);
CREATE INDEX "IDX_role_match_scores_artist_casting_call_role"
  ON role_match_scores (artist_id, casting_call_id, role_id);
