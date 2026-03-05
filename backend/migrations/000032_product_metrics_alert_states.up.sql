create table if not exists public.product_metrics_alert_states (
  alert_key text primary key,
  state text not null default 'active',
  acknowledged_by uuid null references public.users(id) on delete set null,
  acknowledged_at timestamptz null,
  snoozed_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_metrics_alert_states_state_chk check (state in ('active', 'acked', 'snoozed'))
);

create index if not exists idx_product_metrics_alert_states_snoozed_until
  on public.product_metrics_alert_states (snoozed_until);
