CREATE TABLE IF NOT EXISTS public.product_metrics_events (
    id BIGSERIAL PRIMARY KEY,
    client_event_id TEXT NOT NULL DEFAULT '',
    event_type TEXT NOT NULL,
    user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    anon_id TEXT NOT NULL DEFAULT '',
    journey_id TEXT NOT NULL,
    cafe_id UUID NULL REFERENCES public.cafes(id) ON DELETE SET NULL,
    review_id UUID NULL REFERENCES public.reviews(id) ON DELETE SET NULL,
    provider TEXT NOT NULL DEFAULT '',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT product_metrics_events_type_chk CHECK (
        event_type IN ('review_read', 'route_click', 'checkin_start')
    ),
    CONSTRAINT product_metrics_events_provider_chk CHECK (
        provider IN ('', '2gis', 'yandex')
    ),
    CONSTRAINT product_metrics_events_journey_chk CHECK (char_length(trim(journey_id)) BETWEEN 1 AND 96),
    CONSTRAINT product_metrics_events_client_event_id_chk CHECK (char_length(client_event_id) <= 128),
    CONSTRAINT product_metrics_events_anon_id_chk CHECK (char_length(anon_id) <= 128)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_metrics_events_client_event_idx
    ON public.product_metrics_events (client_event_id)
    WHERE char_length(client_event_id) > 0;

CREATE INDEX IF NOT EXISTS product_metrics_events_type_occurred_idx
    ON public.product_metrics_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS product_metrics_events_journey_idx
    ON public.product_metrics_events (journey_id, occurred_at ASC);

CREATE INDEX IF NOT EXISTS product_metrics_events_cafe_idx
    ON public.product_metrics_events (cafe_id, occurred_at DESC)
    WHERE cafe_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS product_metrics_events_review_idx
    ON public.product_metrics_events (review_id, occurred_at DESC)
    WHERE review_id IS NOT NULL;
