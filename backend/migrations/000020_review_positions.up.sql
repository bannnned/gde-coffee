CREATE TABLE IF NOT EXISTS public.review_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 1,
    drink_id TEXT NOT NULL DEFAULT '',
    drink_name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT review_positions_position_chk CHECK (position > 0),
    CONSTRAINT review_positions_drink_chk CHECK (
        char_length(trim(drink_id)) > 0
        OR char_length(trim(drink_name)) > 0
    ),
    CONSTRAINT review_positions_unique_review_position UNIQUE (review_id, position)
);

CREATE INDEX IF NOT EXISTS review_positions_review_idx
    ON public.review_positions (review_id, position);

CREATE INDEX IF NOT EXISTS review_positions_drink_idx
    ON public.review_positions (drink_id, drink_name);

INSERT INTO public.review_positions (review_id, position, drink_id, drink_name, created_at, updated_at)
SELECT
    ra.review_id,
    1,
    coalesce(ra.drink_id, ''),
    coalesce(ra.drink_name, ''),
    now(),
    now()
FROM public.review_attributes ra
JOIN public.reviews r ON r.id = ra.review_id
WHERE char_length(trim(coalesce(ra.drink_id, ''))) > 0
   OR char_length(trim(coalesce(ra.drink_name, ''))) > 0
ON CONFLICT (review_id, position) DO NOTHING;
