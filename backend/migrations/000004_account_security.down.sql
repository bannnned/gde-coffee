DROP INDEX IF EXISTS public.password_reset_tokens_expires_at_idx;
DROP INDEX IF EXISTS public.password_reset_tokens_user_id_idx;
DROP TABLE IF EXISTS public.password_reset_tokens;

DROP INDEX IF EXISTS public.email_change_requests_expires_at_idx;
DROP INDEX IF EXISTS public.email_change_requests_user_id_idx;
DROP TABLE IF EXISTS public.email_change_requests;

DROP INDEX IF EXISTS public.email_verifications_expires_at_idx;
DROP INDEX IF EXISTS public.email_verifications_user_id_idx;
DROP TABLE IF EXISTS public.email_verifications;

ALTER TABLE public.users
    DROP COLUMN IF EXISTS email_verified_at,
    DROP COLUMN IF EXISTS updated_at;