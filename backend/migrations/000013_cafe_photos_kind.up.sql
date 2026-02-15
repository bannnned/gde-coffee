ALTER TABLE public.cafe_photos
    ADD COLUMN IF NOT EXISTS kind TEXT;

UPDATE public.cafe_photos
SET kind = 'cafe'
WHERE kind IS NULL OR btrim(kind) = '';

ALTER TABLE public.cafe_photos
    ALTER COLUMN kind SET DEFAULT 'cafe';

ALTER TABLE public.cafe_photos
    ALTER COLUMN kind SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'cafe_photos_kind_check'
    ) THEN
        ALTER TABLE public.cafe_photos
            ADD CONSTRAINT cafe_photos_kind_check
            CHECK (kind IN ('cafe', 'menu'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'cafe_photos_menu_cover_check'
    ) THEN
        ALTER TABLE public.cafe_photos
            ADD CONSTRAINT cafe_photos_menu_cover_check
            CHECK (kind <> 'menu' OR is_cover = FALSE);
    END IF;
END $$;

DROP INDEX IF EXISTS public.cafe_photos_cafe_position_idx;
CREATE INDEX IF NOT EXISTS cafe_photos_cafe_kind_position_idx
    ON public.cafe_photos (cafe_id, kind, position);

DROP INDEX IF EXISTS public.cafe_photos_cover_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS cafe_photos_cover_unique_idx
    ON public.cafe_photos (cafe_id, kind)
    WHERE is_cover = TRUE;
