DROP INDEX IF EXISTS cafes_amenities_gin;

ALTER TABLE public.cafes
DROP COLUMN IF EXISTS amenities;
