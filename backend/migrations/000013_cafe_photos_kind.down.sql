DROP INDEX IF EXISTS public.cafe_photos_cover_unique_idx;
DROP INDEX IF EXISTS public.cafe_photos_cafe_kind_position_idx;

CREATE INDEX IF NOT EXISTS cafe_photos_cafe_position_idx
    ON public.cafe_photos (cafe_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS cafe_photos_cover_unique_idx
    ON public.cafe_photos (cafe_id)
    WHERE is_cover = TRUE;

ALTER TABLE public.cafe_photos
    DROP CONSTRAINT IF EXISTS cafe_photos_menu_cover_check;

ALTER TABLE public.cafe_photos
    DROP CONSTRAINT IF EXISTS cafe_photos_kind_check;

ALTER TABLE public.cafe_photos
    DROP COLUMN IF EXISTS kind;
