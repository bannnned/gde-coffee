DROP INDEX IF EXISTS public.drink_unknown_formats_mapped_idx;
DROP INDEX IF EXISTS public.drink_unknown_formats_status_seen_idx;
DROP TABLE IF EXISTS public.drink_unknown_formats;

ALTER TABLE public.drinks
    DROP CONSTRAINT IF EXISTS drinks_name_lower_chk;

ALTER TABLE public.drinks
    DROP CONSTRAINT IF EXISTS drinks_id_lower_chk;

ALTER TABLE public.drinks
    DROP COLUMN IF EXISTS description;
