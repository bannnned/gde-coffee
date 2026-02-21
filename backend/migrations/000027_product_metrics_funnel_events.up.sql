ALTER TABLE public.product_metrics_events
    DROP CONSTRAINT IF EXISTS product_metrics_events_type_chk;

ALTER TABLE public.product_metrics_events
    ADD CONSTRAINT product_metrics_events_type_chk CHECK (
        event_type IN (
            'cafe_card_open',
            'review_read',
            'route_click',
            'checkin_start',
            'review_submit'
        )
    );
