CREATE TABLE IF NOT EXISTS public.app_feedback (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    contact TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT app_feedback_message_len_chk CHECK (char_length(message) BETWEEN 1 AND 4000),
    CONSTRAINT app_feedback_contact_len_chk CHECK (char_length(contact) <= 255),
    CONSTRAINT app_feedback_user_agent_len_chk CHECK (char_length(user_agent) <= 512)
);

CREATE INDEX IF NOT EXISTS app_feedback_user_created_idx
    ON public.app_feedback (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS app_feedback_created_idx
    ON public.app_feedback (created_at DESC);
