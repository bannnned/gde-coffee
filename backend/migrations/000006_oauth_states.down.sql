DROP INDEX IF EXISTS public.oauth_states_expires_at_idx;
DROP INDEX IF EXISTS public.oauth_states_user_id_idx;
DROP INDEX IF EXISTS public.oauth_states_provider_idx;
DROP TABLE IF EXISTS public.oauth_states;