DROP INDEX IF EXISTS public.moderation_events_submission_idx;
DROP TABLE IF EXISTS public.moderation_events;

DROP INDEX IF EXISTS public.moderation_submissions_target_idx;
DROP INDEX IF EXISTS public.moderation_submissions_status_idx;
DROP INDEX IF EXISTS public.moderation_submissions_author_idx;
DROP TABLE IF EXISTS public.moderation_submissions;

ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_role_chk;

ALTER TABLE public.users
DROP COLUMN IF EXISTS role;
