create table test_ping (
  id serial primary key,
  created_at timestamptz default now()
);