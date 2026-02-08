CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE public.cafes
    ADD COLUMN IF NOT EXISTS geog geography(Point, 4326);

UPDATE public.cafes
SET geog = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE geog IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS cafes_geog_gix ON public.cafes USING GIST (geog);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cafes_lat_chk'
    ) THEN
        ALTER TABLE public.cafes
            ADD CONSTRAINT cafes_lat_chk CHECK (lat BETWEEN -90 AND 90);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cafes_lng_chk'
    ) THEN
        ALTER TABLE public.cafes
            ADD CONSTRAINT cafes_lng_chk CHECK (lng BETWEEN -180 AND 180);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cafes' AND column_name = 'amenities'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS cafes_amenities_gin ON public.cafes USING GIN (amenities)';
    END IF;
END $$;