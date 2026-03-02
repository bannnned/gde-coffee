ALTER TABLE public.cafes
ADD COLUMN IF NOT EXISTS amenities TEXT[];

CREATE INDEX IF NOT EXISTS cafes_amenities_gin ON public.cafes USING GIN (amenities);
