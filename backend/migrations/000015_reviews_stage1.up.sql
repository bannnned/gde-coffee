CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    cafe_id UUID NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'published',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT reviews_rating_chk CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT reviews_status_chk CHECK (status IN ('published', 'hidden', 'removed')),
    CONSTRAINT reviews_unique_user_cafe UNIQUE (user_id, cafe_id)
);

CREATE INDEX IF NOT EXISTS reviews_cafe_created_idx
    ON public.reviews (cafe_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reviews_user_created_idx
    ON public.reviews (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.review_attributes (
    review_id UUID PRIMARY KEY REFERENCES public.reviews(id) ON DELETE CASCADE,
    drink_name TEXT NOT NULL,
    taste_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
    summary_length INT NOT NULL DEFAULT 0,
    photo_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT review_attributes_summary_length_chk CHECK (summary_length >= 0),
    CONSTRAINT review_attributes_photo_count_chk CHECK (photo_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.visit_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL UNIQUE REFERENCES public.reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    cafe_id UUID NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
    confidence TEXT NOT NULL DEFAULT 'none',
    verified_at TIMESTAMPTZ NULL,
    dwell_seconds INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT visit_verifications_confidence_chk CHECK (confidence IN ('none', 'low', 'medium', 'high')),
    CONSTRAINT visit_verifications_dwell_seconds_chk CHECK (dwell_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS visit_verifications_user_created_idx
    ON public.visit_verifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS visit_verifications_cafe_verified_idx
    ON public.visit_verifications (cafe_id, verified_at DESC);

CREATE TABLE IF NOT EXISTS public.helpful_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    voter_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    weight NUMERIC(6,3) NOT NULL DEFAULT 1.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT helpful_votes_weight_chk CHECK (weight > 0),
    CONSTRAINT helpful_votes_unique_vote UNIQUE (review_id, voter_user_id)
);

CREATE INDEX IF NOT EXISTS helpful_votes_review_created_idx
    ON public.helpful_votes (review_id, created_at DESC);

CREATE INDEX IF NOT EXISTS helpful_votes_voter_created_idx
    ON public.helpful_votes (voter_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.reputation_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    points INT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The unique tuple makes reputation updates idempotent for repeated event processing.
CREATE UNIQUE INDEX IF NOT EXISTS reputation_events_dedupe_idx
    ON public.reputation_events (user_id, event_type, source_type, source_id);

CREATE INDEX IF NOT EXISTS reputation_events_user_created_idx
    ON public.reputation_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.abuse_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    reporter_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    confirmed_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT abuse_reports_status_chk CHECK (status IN ('pending', 'confirmed', 'rejected')),
    CONSTRAINT abuse_reports_unique_reporter UNIQUE (review_id, reporter_user_id)
);

CREATE INDEX IF NOT EXISTS abuse_reports_review_created_idx
    ON public.abuse_reports (review_id, created_at DESC);

CREATE INDEX IF NOT EXISTS abuse_reports_status_created_idx
    ON public.abuse_reports (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cafe_rating_snapshots (
    cafe_id UUID PRIMARY KEY REFERENCES public.cafes(id) ON DELETE CASCADE,
    formula_version TEXT NOT NULL DEFAULT 'rating_v1',
    rating NUMERIC(3,2) NOT NULL DEFAULT 0,
    reviews_count INT NOT NULL DEFAULT 0,
    verified_reviews_count INT NOT NULL DEFAULT 0,
    fraud_risk NUMERIC(4,3) NOT NULL DEFAULT 0,
    components JSONB NOT NULL DEFAULT '{}'::jsonb,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT cafe_rating_snapshots_rating_chk CHECK (rating >= 0 AND rating <= 5),
    CONSTRAINT cafe_rating_snapshots_reviews_chk CHECK (reviews_count >= 0),
    CONSTRAINT cafe_rating_snapshots_verified_chk CHECK (verified_reviews_count >= 0),
    CONSTRAINT cafe_rating_snapshots_fraud_chk CHECK (fraud_risk >= 0 AND fraud_risk <= 1)
);

CREATE INDEX IF NOT EXISTS cafe_rating_snapshots_rating_idx
    ON public.cafe_rating_snapshots (rating DESC, reviews_count DESC);

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    scope TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_status INT NOT NULL,
    response_body JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idempotency_keys_created_idx
    ON public.idempotency_keys (created_at DESC);

CREATE TABLE IF NOT EXISTS public.domain_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id UUID NOT NULL,
    dedupe_key TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT domain_events_status_chk CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
    CONSTRAINT domain_events_attempts_chk CHECK (attempts >= 0),
    CONSTRAINT domain_events_dedupe_key_uniq UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS domain_events_pending_idx
    ON public.domain_events (status, available_at, id);

CREATE INDEX IF NOT EXISTS domain_events_aggregate_idx
    ON public.domain_events (aggregate_type, aggregate_id, created_at DESC);
