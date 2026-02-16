ALTER TABLE public.review_attributes
    ADD COLUMN IF NOT EXISTS drink_id TEXT NOT NULL DEFAULT '';

ALTER TABLE public.review_attributes
    ADD COLUMN IF NOT EXISTS summary_fingerprint TEXT NOT NULL DEFAULT '';

UPDATE public.review_attributes
   SET drink_id = trim(drink_name)
 WHERE drink_id = ''
   AND trim(drink_name) <> '';

CREATE INDEX IF NOT EXISTS review_attributes_drink_id_idx
    ON public.review_attributes (drink_id);

CREATE INDEX IF NOT EXISTS review_attributes_summary_fingerprint_idx
    ON public.review_attributes (summary_fingerprint);

CREATE TABLE IF NOT EXISTS public.review_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    position INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT review_photos_url_chk CHECK (char_length(trim(photo_url)) > 0),
    CONSTRAINT review_photos_position_chk CHECK (position > 0),
    CONSTRAINT review_photos_unique_review_position UNIQUE (review_id, position),
    CONSTRAINT review_photos_unique_review_url UNIQUE (review_id, photo_url)
);

CREATE INDEX IF NOT EXISTS review_photos_review_position_idx
    ON public.review_photos (review_id, position);

CREATE INDEX IF NOT EXISTS review_photos_created_idx
    ON public.review_photos (created_at DESC);
