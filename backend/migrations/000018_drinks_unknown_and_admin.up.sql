ALTER TABLE public.drinks
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

UPDATE public.drinks
   SET id = lower(trim(id)),
       category = lower(trim(category)),
       description = trim(description),
       name = lower(trim(name)),
       aliases = (
           SELECT coalesce(
               array_agg(distinct normalized_alias ORDER BY normalized_alias),
               '{}'::text[]
           )
           FROM (
               SELECT lower(trim(alias_item)) AS normalized_alias
               FROM unnest(coalesce(aliases, '{}'::text[])) AS alias_item
               WHERE trim(alias_item) <> ''
           ) AS prepared
       ),
       updated_at = now();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'drinks_id_lower_chk'
    ) THEN
        ALTER TABLE public.drinks
            ADD CONSTRAINT drinks_id_lower_chk CHECK (id = lower(id));
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'drinks_name_lower_chk'
    ) THEN
        ALTER TABLE public.drinks
            ADD CONSTRAINT drinks_name_lower_chk CHECK (name = lower(name));
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.drink_unknown_formats (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    mentions_count INT NOT NULL DEFAULT 1,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'new',
    mapped_drink_id TEXT NULL REFERENCES public.drinks(id) ON DELETE SET NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT drink_unknown_formats_name_chk CHECK (char_length(trim(name)) >= 2),
    CONSTRAINT drink_unknown_formats_name_lower_chk CHECK (name = lower(name)),
    CONSTRAINT drink_unknown_formats_status_chk CHECK (status IN ('new', 'mapped', 'ignored')),
    CONSTRAINT drink_unknown_formats_mentions_chk CHECK (mentions_count >= 0)
);

CREATE INDEX IF NOT EXISTS drink_unknown_formats_status_seen_idx
    ON public.drink_unknown_formats (status, last_seen_at DESC, mentions_count DESC);

CREATE INDEX IF NOT EXISTS drink_unknown_formats_mapped_idx
    ON public.drink_unknown_formats (mapped_drink_id, status);
