alter table public.product_metrics_alert_states
  add column if not exists owner text null,
  add column if not exists comment text null;

alter table public.product_metrics_alert_actions
  add column if not exists owner text null,
  add column if not exists comment text null;
