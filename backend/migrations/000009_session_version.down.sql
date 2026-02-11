DROP INDEX IF EXISTS sessions_user_version_idx;

ALTER TABLE sessions
    DROP COLUMN IF EXISTS user_session_version;

ALTER TABLE users
    DROP COLUMN IF EXISTS session_version;
