ALTER TABLE public.oauth_states
    DROP COLUMN IF EXISTS redirect_uri;