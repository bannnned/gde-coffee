ALTER TABLE users
    ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 0;

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS user_session_version INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS sessions_user_version_idx ON sessions (user_id, user_session_version);
