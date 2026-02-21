CREATE TABLE IF NOT EXISTS public.user_tag_preferences (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    tag_key TEXT NOT NULL,
    tag_label TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, category, tag_key)
);

CREATE INDEX IF NOT EXISTS user_tag_preferences_user_category_idx
    ON public.user_tag_preferences (user_id, category, position, updated_at DESC);

CREATE INDEX IF NOT EXISTS user_tag_preferences_category_tag_idx
    ON public.user_tag_preferences (category, tag_key);
