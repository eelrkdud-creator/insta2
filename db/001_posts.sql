CREATE TABLE IF NOT EXISTS instagram_posts (
  instagram_post_id TEXT PRIMARY KEY,
  instagram_url TEXT NOT NULL,
  account_name TEXT,
  account_id TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL,
  post_type TEXT NOT NULL CHECK (post_type IN ('reels', 'post')),
  edited BOOLEAN NOT NULL,
  brand TEXT NOT NULL CHECK (brand IN ('meitu', 'beautycam')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS instagram_posts_brand_type_time_idx
  ON instagram_posts (brand, post_type, uploaded_at);
