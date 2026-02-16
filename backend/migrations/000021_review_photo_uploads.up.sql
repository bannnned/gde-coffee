CREATE TABLE IF NOT EXISTS public.review_photo_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    temp_object_key TEXT NOT NULL UNIQUE,
    final_object_key TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    mime_type TEXT NOT NULL DEFAULT '',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ NULL,
    CONSTRAINT review_photo_uploads_status_chk CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    CONSTRAINT review_photo_uploads_temp_key_chk CHECK (char_length(trim(temp_object_key)) > 0),
    CONSTRAINT review_photo_uploads_final_key_ready_chk CHECK (
        status <> 'ready' OR char_length(trim(final_object_key)) > 0
    ),
    CONSTRAINT review_photo_uploads_size_chk CHECK (size_bytes >= 0)
);

CREATE INDEX IF NOT EXISTS review_photo_uploads_user_status_idx
    ON public.review_photo_uploads (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS review_photo_uploads_status_updated_idx
    ON public.review_photo_uploads (status, updated_at DESC);
