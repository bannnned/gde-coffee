-- Allow users created via OAuth without email
ALTER TABLE users
    ALTER COLUMN email_normalized DROP NOT NULL;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_email_normalized_key;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique
    ON users (email_normalized)
    WHERE email_normalized IS NOT NULL;
