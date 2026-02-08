ALTER TABLE public.oauth_states
    ADD COLUMN IF NOT EXISTS redirect_uri TEXT;