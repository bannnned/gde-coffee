CREATE TABLE IF NOT EXISTS public.identities (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    email TEXT NULL,
    email_normalized TEXT NULL,
    display_name TEXT NULL,
    avatar_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS identities_user_id_idx ON public.identities (user_id);
CREATE INDEX IF NOT EXISTS identities_provider_email_norm_idx ON public.identities (provider, email_normalized);
CREATE INDEX IF NOT EXISTS identities_email_norm_idx ON public.identities (email_normalized);