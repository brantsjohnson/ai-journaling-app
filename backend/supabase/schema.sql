CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  duration_ms INTEGER,
  local_path TEXT, -- Supabase Storage public URL
  transcript_id INTEGER,
  journal_date DATE DEFAULT CURRENT_DATE,
  drive_sync_enabled BOOLEAN DEFAULT FALSE,
  sync_status TEXT,
  last_sync_error TEXT
);

CREATE TABLE IF NOT EXISTS transcripts (
  id SERIAL PRIMARY KEY,
  recording_id INTEGER NOT NULL REFERENCES entries(id),
  text TEXT NOT NULL,
  language TEXT,
  confidence REAL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  duration_ms INTEGER,
  local_path TEXT,
  transcript_id INTEGER,
  journal_date DATE DEFAULT CURRENT_DATE,
  drive_sync_enabled BOOLEAN DEFAULT FALSE,
  sync_status TEXT,
  last_sync_error TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (transcript_id) REFERENCES transcripts(id)
);

CREATE TABLE IF NOT EXISTS transcripts (
  id SERIAL PRIMARY KEY,
  recording_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  language TEXT,
  confidence REAL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recording_id) REFERENCES entries(id)
);

