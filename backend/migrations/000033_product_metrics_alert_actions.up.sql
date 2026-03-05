create table if not exists public.product_metrics_alert_actions (
  id bigserial primary key,
  alert_key text not null references public.product_metrics_alert_states(alert_key) on delete cascade,
  action text not null,
  actor_user_id uuid null references public.users(id) on delete set null,
  snooze_hours int null,
  created_at timestamptz not null default now(),
  constraint product_metrics_alert_actions_action_chk check (action in ('ack', 'snooze', 'reset')),
  constraint product_metrics_alert_actions_snooze_chk check (
    (action = 'snooze' and coalesce(snooze_hours, 0) > 0)
    or (action <> 'snooze' and snooze_hours is null)
  )
);

create index if not exists idx_product_metrics_alert_actions_created_at
  on public.product_metrics_alert_actions (created_at desc);

create index if not exists idx_product_metrics_alert_actions_alert_key
  on public.product_metrics_alert_actions (alert_key);
