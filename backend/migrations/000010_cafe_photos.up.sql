CREATE TABLE IF NOT EXISTS public.cafe_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafe_id UUID NOT NULL REFERENCES public.cafes (id) ON DELETE CASCADE,
    object_key TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    position INT NOT NULL DEFAULT 0,
    is_cover BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_by UUID NULL REFERENCES public.users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cafe_photos_cafe_id_idx ON public.cafe_photos (cafe_id);
CREATE INDEX IF NOT EXISTS cafe_photos_cafe_position_idx ON public.cafe_photos (cafe_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS cafe_photos_cover_unique_idx
    ON public.cafe_photos (cafe_id)
    WHERE is_cover = TRUE;
