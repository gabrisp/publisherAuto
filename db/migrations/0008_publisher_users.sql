CREATE TABLE publisher_users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  display_name text,
  created_at bigint NOT NULL
);

CREATE TABLE user_tiktok_accounts (
  user_id text NOT NULL REFERENCES publisher_users(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, account_id)
);

ALTER TABLE carousels ADD COLUMN publisher_user_id text REFERENCES publisher_users(id) ON DELETE SET NULL;
ALTER TABLE carousels ADD COLUMN scheduled_time text;
