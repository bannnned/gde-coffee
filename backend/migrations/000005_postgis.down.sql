DROP INDEX IF EXISTS public.cafes_amenities_gin;
DROP INDEX IF EXISTS public.cafes_geog_gix;

ALTER TABLE public.cafes
    DROP CONSTRAINT IF EXISTS cafes_lat_chk,
    DROP CONSTRAINT IF EXISTS cafes_lng_chk;

ALTER TABLE public.cafes
    DROP COLUMN IF EXISTS geog;