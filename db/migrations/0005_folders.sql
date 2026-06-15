CREATE TABLE folders (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  created_at bigint NOT NULL
);

ALTER TABLE carousels ADD COLUMN folder_id text REFERENCES folders(id) ON DELETE SET NULL;
