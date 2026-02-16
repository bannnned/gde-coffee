CREATE TABLE IF NOT EXISTS public.domain_event_inbox (
    id BIGSERIAL PRIMARY KEY,
    outbox_event_id BIGINT NOT NULL REFERENCES public.domain_events(id) ON DELETE CASCADE,
    consumer TEXT NOT NULL,
    event_type TEXT NOT NULL,
    aggregate_id UUID NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ NULL,
    CONSTRAINT domain_event_inbox_status_chk CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
    CONSTRAINT domain_event_inbox_attempts_chk CHECK (attempts >= 0),
    CONSTRAINT domain_event_inbox_outbox_consumer_uniq UNIQUE (outbox_event_id, consumer)
);

CREATE INDEX IF NOT EXISTS domain_event_inbox_pending_idx
    ON public.domain_event_inbox (status, available_at, id);

CREATE INDEX IF NOT EXISTS domain_event_inbox_consumer_pending_idx
    ON public.domain_event_inbox (consumer, status, available_at, id);

CREATE INDEX IF NOT EXISTS domain_event_inbox_outbox_idx
    ON public.domain_event_inbox (outbox_event_id);

CREATE TABLE IF NOT EXISTS public.domain_event_dlq (
    id BIGSERIAL PRIMARY KEY,
    inbox_event_id BIGINT NULL REFERENCES public.domain_event_inbox(id) ON DELETE SET NULL,
    outbox_event_id BIGINT NOT NULL REFERENCES public.domain_events(id) ON DELETE CASCADE,
    consumer TEXT NOT NULL,
    event_type TEXT NOT NULL,
    aggregate_id UUID NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT NOT NULL DEFAULT '',
    failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ NULL,
    CONSTRAINT domain_event_dlq_attempts_chk CHECK (attempts >= 0),
    CONSTRAINT domain_event_dlq_outbox_consumer_uniq UNIQUE (outbox_event_id, consumer)
);

CREATE INDEX IF NOT EXISTS domain_event_dlq_unresolved_idx
    ON public.domain_event_dlq (failed_at DESC)
    WHERE resolved_at IS NULL;
