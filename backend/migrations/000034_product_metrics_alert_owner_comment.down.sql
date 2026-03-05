alter table public.product_metrics_alert_actions
  drop column if exists comment,
  drop column if exists owner;

alter table public.product_metrics_alert_states
  drop column if exists comment,
  drop column if exists owner;
