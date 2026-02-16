DROP INDEX IF EXISTS public.domain_event_dlq_unresolved_idx;
DROP TABLE IF EXISTS public.domain_event_dlq;

DROP INDEX IF EXISTS public.domain_event_inbox_outbox_idx;
DROP INDEX IF EXISTS public.domain_event_inbox_consumer_pending_idx;
DROP INDEX IF EXISTS public.domain_event_inbox_pending_idx;
DROP TABLE IF EXISTS public.domain_event_inbox;
