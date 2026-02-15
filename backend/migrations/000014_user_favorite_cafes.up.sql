CREATE TABLE IF NOT EXISTS public.user_favorite_cafes (
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    cafe_id UUID NOT NULL REFERENCES public.cafes (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, cafe_id)
);

CREATE INDEX IF NOT EXISTS user_favorite_cafes_user_created_idx
    ON public.user_favorite_cafes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_favorite_cafes_cafe_idx
    ON public.user_favorite_cafes (cafe_id);
