CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  source_prompt TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('english', 'hindi', 'hinglish')),
  language_preference TEXT CHECK (language_preference IS NULL OR language_preference IN ('en', 'hi', 'hinglish')),
  spec_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects (created_at DESC);
