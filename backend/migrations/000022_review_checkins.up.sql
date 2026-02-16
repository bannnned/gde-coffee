CREATE TABLE IF NOT EXISTS public.review_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    cafe_id UUID NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'started',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at TIMESTAMPTZ NULL,
    verified_review_id UUID NULL REFERENCES public.reviews(id) ON DELETE SET NULL,
    start_lat DOUBLE PRECISION NOT NULL,
    start_lng DOUBLE PRECISION NOT NULL,
    verify_lat DOUBLE PRECISION NULL,
    verify_lng DOUBLE PRECISION NULL,
    start_distance_m INT NOT NULL DEFAULT 0,
    verify_distance_m INT NOT NULL DEFAULT 0,
    dwell_seconds INT NOT NULL DEFAULT 0,
    confidence TEXT NOT NULL DEFAULT 'none',
    risk_flags TEXT[] NOT NULL DEFAULT '{}'::text[],
    user_agent_hash TEXT NOT NULL DEFAULT '',
    ip_prefix TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT review_checkins_status_chk CHECK (status IN ('started', 'verified', 'expired', 'rejected')),
    CONSTRAINT review_checkins_confidence_chk CHECK (confidence IN ('none', 'low', 'medium', 'high')),
    CONSTRAINT review_checkins_start_distance_chk CHECK (start_distance_m >= 0),
    CONSTRAINT review_checkins_verify_distance_chk CHECK (verify_distance_m >= 0),
    CONSTRAINT review_checkins_dwell_chk CHECK (dwell_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS review_checkins_user_started_idx
    ON public.review_checkins (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS review_checkins_cafe_started_idx
    ON public.review_checkins (cafe_id, started_at DESC);

CREATE INDEX IF NOT EXISTS review_checkins_status_idx
    ON public.review_checkins (status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS review_checkins_active_user_cafe_idx
    ON public.review_checkins (user_id, cafe_id)
    WHERE status = 'started';
