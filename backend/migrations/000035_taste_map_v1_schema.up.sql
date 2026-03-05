CREATE TABLE IF NOT EXISTS public.taste_taxonomy (
    code TEXT PRIMARY KEY,
    group_code TEXT NOT NULL,
    display_name TEXT NOT NULL,
    allowed_polarity TEXT[] NOT NULL DEFAULT ARRAY['positive']::text[],
    description TEXT NOT NULL DEFAULT '',
    version TEXT NOT NULL DEFAULT '2026-03-05',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT taste_taxonomy_group_chk CHECK (
        group_code IN (
            'flavor_family',
            'structure',
            'brew_preference',
            'milk_preference',
            'serving',
            'context'
        )
    ),
    CONSTRAINT taste_taxonomy_allowed_polarity_chk CHECK (
        cardinality(allowed_polarity) >= 1
        AND allowed_polarity <@ ARRAY['positive', 'negative']::text[]
    ),
    CONSTRAINT taste_taxonomy_version_chk CHECK (length(trim(version)) > 0),
    CONSTRAINT taste_taxonomy_sort_order_chk CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS taste_taxonomy_group_sort_idx
    ON public.taste_taxonomy (group_code, sort_order, code);

CREATE TABLE IF NOT EXISTS public.taste_onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'started',
    answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT taste_onboarding_sessions_version_chk CHECK (length(trim(version)) > 0),
    CONSTRAINT taste_onboarding_sessions_status_chk CHECK (status IN ('started', 'completed', 'abandoned')),
    CONSTRAINT taste_onboarding_sessions_answers_type_chk CHECK (jsonb_typeof(answers_json) IN ('object', 'array')),
    CONSTRAINT taste_onboarding_sessions_completed_at_chk CHECK (
        (status = 'completed' AND completed_at IS NOT NULL)
        OR (status IN ('started', 'abandoned') AND completed_at IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS taste_onboarding_sessions_user_created_idx
    ON public.taste_onboarding_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS taste_onboarding_sessions_user_status_idx
    ON public.taste_onboarding_sessions (user_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS taste_onboarding_sessions_user_active_idx
    ON public.taste_onboarding_sessions (user_id)
    WHERE status = 'started';

CREATE TABLE IF NOT EXISTS public.user_taste_profile (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    active_onboarding_version TEXT NULL,
    inference_version TEXT NOT NULL DEFAULT 'taste_inference_v1',
    base_map_completed_at TIMESTAMPTZ NULL,
    last_recomputed_at TIMESTAMPTZ NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_taste_profile_inference_version_chk CHECK (length(trim(inference_version)) > 0),
    CONSTRAINT user_taste_profile_metadata_type_chk CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS user_taste_profile_inference_updated_idx
    ON public.user_taste_profile (inference_version, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.user_taste_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    taste_code TEXT NOT NULL REFERENCES public.taste_taxonomy(code) ON DELETE RESTRICT,
    polarity TEXT NOT NULL,
    score NUMERIC(6,3) NOT NULL DEFAULT 0,
    confidence NUMERIC(6,3) NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'mixed',
    status TEXT NOT NULL DEFAULT 'active',
    cooldown_until TIMESTAMPTZ NULL,
    reason_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_taste_tags_polarity_chk CHECK (polarity IN ('positive', 'negative')),
    CONSTRAINT user_taste_tags_score_chk CHECK (score >= -1 AND score <= 1),
    CONSTRAINT user_taste_tags_confidence_chk CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT user_taste_tags_source_chk CHECK (source IN ('onboarding', 'behavior', 'mixed', 'explicit_feedback')),
    CONSTRAINT user_taste_tags_status_chk CHECK (status IN ('active', 'muted', 'rejected')),
    CONSTRAINT user_taste_tags_reason_type_chk CHECK (jsonb_typeof(reason_json) = 'object'),
    CONSTRAINT user_taste_tags_unique_key UNIQUE (user_id, taste_code, polarity)
);

CREATE INDEX IF NOT EXISTS user_taste_tags_user_status_updated_idx
    ON public.user_taste_tags (user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS user_taste_tags_user_confidence_idx
    ON public.user_taste_tags (user_id, confidence DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.taste_hypotheses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    taste_code TEXT NOT NULL REFERENCES public.taste_taxonomy(code) ON DELETE RESTRICT,
    polarity TEXT NOT NULL,
    score NUMERIC(6,3) NOT NULL DEFAULT 0,
    confidence NUMERIC(6,3) NOT NULL DEFAULT 0,
    reason_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'new',
    dismiss_count INTEGER NOT NULL DEFAULT 0,
    cooldown_until TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT taste_hypotheses_polarity_chk CHECK (polarity IN ('positive', 'negative')),
    CONSTRAINT taste_hypotheses_score_chk CHECK (score >= -1 AND score <= 1),
    CONSTRAINT taste_hypotheses_confidence_chk CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT taste_hypotheses_status_chk CHECK (status IN ('new', 'accepted', 'dismissed', 'expired')),
    CONSTRAINT taste_hypotheses_dismiss_count_chk CHECK (dismiss_count >= 0),
    CONSTRAINT taste_hypotheses_reason_type_chk CHECK (jsonb_typeof(reason_json) = 'object')
);

CREATE INDEX IF NOT EXISTS taste_hypotheses_user_status_created_idx
    ON public.taste_hypotheses (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS taste_hypotheses_user_updated_idx
    ON public.taste_hypotheses (user_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS taste_hypotheses_user_taste_new_idx
    ON public.taste_hypotheses (user_id, taste_code, polarity)
    WHERE status = 'new';

CREATE TABLE IF NOT EXISTS public.taste_inference_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    trigger TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'taste_inference_v1',
    input_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    changed_tags_count INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ok',
    error_text TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT taste_inference_runs_trigger_chk CHECK (length(trim(trigger)) > 0),
    CONSTRAINT taste_inference_runs_version_chk CHECK (length(trim(version)) > 0),
    CONSTRAINT taste_inference_runs_input_type_chk CHECK (jsonb_typeof(input_snapshot_json) IN ('object', 'array')),
    CONSTRAINT taste_inference_runs_output_type_chk CHECK (jsonb_typeof(output_snapshot_json) IN ('object', 'array')),
    CONSTRAINT taste_inference_runs_changed_tags_chk CHECK (changed_tags_count >= 0),
    CONSTRAINT taste_inference_runs_duration_chk CHECK (duration_ms >= 0),
    CONSTRAINT taste_inference_runs_status_chk CHECK (status IN ('ok', 'failed'))
);

CREATE INDEX IF NOT EXISTS taste_inference_runs_user_created_idx
    ON public.taste_inference_runs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS taste_inference_runs_status_created_idx
    ON public.taste_inference_runs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS taste_inference_runs_trigger_created_idx
    ON public.taste_inference_runs (trigger, created_at DESC);
