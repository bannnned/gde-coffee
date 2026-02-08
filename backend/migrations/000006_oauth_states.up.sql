CREATE TABLE IF NOT EXISTS public.oauth_states (
    id BIGSERIAL PRIMARY KEY,
    provider TEXT NOT NULL,
    flow TEXT NOT NULL,
    token_hash BYTEA NOT NULL UNIQUE,
    user_id UUID NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS oauth_states_provider_idx ON public.oauth_states (provider);
CREATE INDEX IF NOT EXISTS oauth_states_user_id_idx ON public.oauth_states (user_id);
CREATE INDEX IF NOT EXISTS oauth_states_expires_at_idx ON public.oauth_states (expires_at);