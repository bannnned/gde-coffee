CREATE TABLE IF NOT EXISTS public.ai_summary_metrics (
    id BIGSERIAL PRIMARY KEY,
    cafe_id UUID NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    used_reviews INT NOT NULL DEFAULT 0,
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    input_hash TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_summary_metrics_used_reviews_chk CHECK (used_reviews >= 0),
    CONSTRAINT ai_summary_metrics_prompt_tokens_chk CHECK (prompt_tokens >= 0),
    CONSTRAINT ai_summary_metrics_completion_tokens_chk CHECK (completion_tokens >= 0),
    CONSTRAINT ai_summary_metrics_total_tokens_chk CHECK (total_tokens >= 0)
);

CREATE INDEX IF NOT EXISTS ai_summary_metrics_created_idx
    ON public.ai_summary_metrics (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_summary_metrics_cafe_created_idx
    ON public.ai_summary_metrics (cafe_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_summary_metrics_status_created_idx
    ON public.ai_summary_metrics (status, created_at DESC);
