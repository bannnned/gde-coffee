DROP INDEX IF EXISTS public.domain_events_aggregate_idx;
DROP INDEX IF EXISTS public.domain_events_pending_idx;
DROP TABLE IF EXISTS public.domain_events;

DROP INDEX IF EXISTS public.idempotency_keys_created_idx;
DROP TABLE IF EXISTS public.idempotency_keys;

DROP INDEX IF EXISTS public.cafe_rating_snapshots_rating_idx;
DROP TABLE IF EXISTS public.cafe_rating_snapshots;

DROP INDEX IF EXISTS public.abuse_reports_status_created_idx;
DROP INDEX IF EXISTS public.abuse_reports_review_created_idx;
DROP TABLE IF EXISTS public.abuse_reports;

DROP INDEX IF EXISTS public.reputation_events_user_created_idx;
DROP INDEX IF EXISTS public.reputation_events_dedupe_idx;
DROP TABLE IF EXISTS public.reputation_events;

DROP INDEX IF EXISTS public.helpful_votes_voter_created_idx;
DROP INDEX IF EXISTS public.helpful_votes_review_created_idx;
DROP TABLE IF EXISTS public.helpful_votes;

DROP INDEX IF EXISTS public.visit_verifications_cafe_verified_idx;
DROP INDEX IF EXISTS public.visit_verifications_user_created_idx;
DROP TABLE IF EXISTS public.visit_verifications;

DROP TABLE IF EXISTS public.review_attributes;

DROP INDEX IF EXISTS public.reviews_user_created_idx;
DROP INDEX IF EXISTS public.reviews_cafe_created_idx;
DROP TABLE IF EXISTS public.reviews;
