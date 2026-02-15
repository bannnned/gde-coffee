ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_role_chk'
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_role_chk CHECK (role IN ('user', 'moderator', 'admin'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.moderation_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    action_type TEXT NOT NULL,
    target_id UUID NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    moderator_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    moderator_comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ NULL
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'moderation_submissions_entity_type_chk'
    ) THEN
        ALTER TABLE public.moderation_submissions
            ADD CONSTRAINT moderation_submissions_entity_type_chk CHECK (
                entity_type IN ('cafe', 'cafe_description', 'cafe_photo', 'menu_photo', 'review')
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'moderation_submissions_action_type_chk'
    ) THEN
        ALTER TABLE public.moderation_submissions
            ADD CONSTRAINT moderation_submissions_action_type_chk CHECK (
                action_type IN ('create', 'update', 'delete')
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'moderation_submissions_status_chk'
    ) THEN
        ALTER TABLE public.moderation_submissions
            ADD CONSTRAINT moderation_submissions_status_chk CHECK (
                status IN ('pending', 'approved', 'rejected', 'needs_changes', 'cancelled')
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS moderation_submissions_author_idx
    ON public.moderation_submissions (author_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS moderation_submissions_status_idx
    ON public.moderation_submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS moderation_submissions_target_idx
    ON public.moderation_submissions (entity_type, target_id);

CREATE TABLE IF NOT EXISTS public.moderation_events (
    id BIGSERIAL PRIMARY KEY,
    submission_id UUID NOT NULL REFERENCES public.moderation_submissions(id) ON DELETE CASCADE,
    actor_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_events_submission_idx
    ON public.moderation_events (submission_id, created_at DESC);
