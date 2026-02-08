-- Revert: require email for all users
DROP INDEX IF EXISTS users_email_normalized_unique;

ALTER TABLE users
    ALTER COLUMN email_normalized SET NOT NULL;

ALTER TABLE users
    ADD CONSTRAINT users_email_normalized_key UNIQUE (email_normalized);
