CREATE TABLE IF NOT EXISTS public.drinks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    aliases TEXT[] NOT NULL DEFAULT '{}'::text[],
    category TEXT NOT NULL DEFAULT 'other',
    popularity_rank INT NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT drinks_id_chk CHECK (char_length(trim(id)) >= 2),
    CONSTRAINT drinks_name_chk CHECK (char_length(trim(name)) >= 2),
    CONSTRAINT drinks_rank_chk CHECK (popularity_rank >= 0)
);

CREATE INDEX IF NOT EXISTS drinks_active_rank_idx
    ON public.drinks (is_active, popularity_rank, name);

CREATE INDEX IF NOT EXISTS drinks_name_lower_idx
    ON public.drinks ((lower(name)));

INSERT INTO public.drinks (id, name, aliases, category, popularity_rank)
VALUES
    ('espresso', 'Эспрессо', ARRAY['espresso'], 'espresso', 1),
    ('doppio', 'Доппио', ARRAY['doppio', 'double espresso'], 'espresso', 2),
    ('ristretto', 'Ристретто', ARRAY['ristretto'], 'espresso', 10),
    ('lungo', 'Лунго', ARRAY['lungo'], 'espresso', 12),
    ('americano', 'Американо', ARRAY['americano'], 'espresso', 3),
    ('long-black', 'Лонг Блэк', ARRAY['long black'], 'espresso', 16),
    ('cappuccino', 'Капучино', ARRAY['cappuccino'], 'espresso', 4),
    ('flat-white', 'Флэт Уайт', ARRAY['flat white'], 'espresso', 5),
    ('latte', 'Латте', ARRAY['latte', 'caffe latte'], 'espresso', 6),
    ('raf', 'Раф', ARRAY['raff', 'raf coffee'], 'signature', 14),
    ('cortado', 'Кортадо', ARRAY['cortado'], 'espresso', 18),
    ('macchiato', 'Макиато', ARRAY['macchiato'], 'espresso', 19),
    ('mocha', 'Мокка', ARRAY['mocha', 'mocca'], 'espresso', 20),
    ('affogato', 'Аффогато', ARRAY['affogato'], 'signature', 25),
    ('espresso-tonic', 'Эспрессо Тоник', ARRAY['espresso tonic'], 'signature', 26),
    ('filter', 'Фильтр-кофе', ARRAY['filter', 'filter coffee', 'фильтр'], 'filter', 7),
    ('batch-brew', 'Батч Брю', ARRAY['batch brew'], 'filter', 15),
    ('v60', 'Воронка V60', ARRAY['v60', 'hario v60', 'воронка', 'пуровер'], 'manual', 8),
    ('kalita-wave', 'Калита Вейв', ARRAY['kalita wave', 'kalita'], 'manual', 17),
    ('chemex', 'Кемекс', ARRAY['chemex'], 'manual', 11),
    ('aeropress', 'Аэропресс', ARRAY['aeropress'], 'manual', 9),
    ('french-press', 'Френч-пресс', ARRAY['french press', 'frenchpress'], 'manual', 21),
    ('siphon', 'Сифон', ARRAY['syphon', 'siphon', 'vacuum pot'], 'manual', 24),
    ('moka-pot', 'Мока-пот', ARRAY['moka', 'moka pot'], 'manual', 22),
    ('cold-brew', 'Колд Брю', ARRAY['cold brew'], 'cold', 13),
    ('nitro-cold-brew', 'Нитро Колд Брю', ARRAY['nitro cold brew', 'nitro'], 'cold', 27),
    ('turkish', 'Кофе по-турецки', ARRAY['turkish coffee', 'ibrik', 'cezve'], 'manual', 28),
    ('decaf-espresso', 'Декаф Эспрессо', ARRAY['decaf', 'decaf espresso'], 'espresso', 29)
ON CONFLICT (id)
DO UPDATE SET
    name = EXCLUDED.name,
    aliases = EXCLUDED.aliases,
    category = EXCLUDED.category,
    popularity_rank = EXCLUDED.popularity_rank,
    is_active = true,
    updated_at = now();
