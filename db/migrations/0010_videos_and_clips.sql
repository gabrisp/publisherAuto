CREATE TABLE IF NOT EXISTS mobile_devices (
  id text PRIMARY KEY,
  name text NOT NULL,
  notes text,
  created_at bigint NOT NULL
);

ALTER TABLE tiktok_accounts
  ADD COLUMN IF NOT EXISTS mobile_device_id text REFERENCES mobile_devices(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS clips (
  id text PRIMARY KEY,
  name text NOT NULL,
  filename text NOT NULL,
  original_name text NOT NULL,
  path text NOT NULL,
  mime_type text,
  duration_ms integer,
  width integer,
  height integer,
  created_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id text PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  description text,
  hashtags text,
  audio_path text,
  export_path text,
  sent_to_account_id text REFERENCES tiktok_accounts(id) ON DELETE SET NULL,
  sent_at bigint,
  publisher_user_id text REFERENCES publisher_users(id) ON DELETE SET NULL,
  scheduled_date text,
  scheduled_time text,
  published_at bigint,
  stats text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS video_clips (
  id text PRIMARY KEY,
  video_id text NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  clip_id text NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  "order" integer NOT NULL,
  trim_start_ms integer NOT NULL DEFAULT 0,
  trim_end_ms integer,
  volume integer NOT NULL DEFAULT 100,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
