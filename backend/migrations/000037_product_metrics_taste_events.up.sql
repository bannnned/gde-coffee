ALTER TABLE public.product_metrics_events
    DROP CONSTRAINT IF EXISTS product_metrics_events_type_chk;

ALTER TABLE public.product_metrics_events
    ADD CONSTRAINT product_metrics_events_type_chk CHECK (
        event_type IN (
            'cafe_card_open',
            'review_read',
            'route_click',
            'checkin_start',
            'review_submit',
            'map_first_render',
            'map_first_interaction',
            'taste_onboarding_started',
            'taste_onboarding_completed',
            'taste_hypothesis_shown',
            'taste_hypothesis_dismissed',
            'taste_hypothesis_confirmed',
            'taste_profile_recomputed',
            'taste_api_error'
        )
    );
