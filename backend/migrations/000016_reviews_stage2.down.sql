DROP INDEX IF EXISTS public.review_photos_created_idx;
DROP INDEX IF EXISTS public.review_photos_review_position_idx;
DROP TABLE IF EXISTS public.review_photos;

DROP INDEX IF EXISTS public.review_attributes_summary_fingerprint_idx;
DROP INDEX IF EXISTS public.review_attributes_drink_id_idx;

ALTER TABLE public.review_attributes
    DROP COLUMN IF EXISTS summary_fingerprint;

ALTER TABLE public.review_attributes
    DROP COLUMN IF EXISTS drink_id;
