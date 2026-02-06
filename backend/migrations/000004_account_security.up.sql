ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.email_verifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash BYTEA NOT NULL UNIQUE,
    email_normalized TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS email_verifications_user_id_idx ON public.email_verifications (user_id);
CREATE INDEX IF NOT EXISTS email_verifications_expires_at_idx ON public.email_verifications (expires_at);

CREATE TABLE IF NOT EXISTS public.email_change_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash BYTEA NOT NULL UNIQUE,
    new_email_normalized TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS email_change_requests_user_id_idx ON public.email_change_requests (user_id);
CREATE INDEX IF NOT EXISTS email_change_requests_expires_at_idx ON public.email_change_requests (expires_at);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash BYTEA NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL,
    requested_ip TEXT NULL,
    requested_ua TEXT NULL
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON public.password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON public.password_reset_tokens (expires_at);