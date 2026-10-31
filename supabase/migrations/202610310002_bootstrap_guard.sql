begin;
create schema if not exists crm_private;
revoke all on schema crm_private from public, anon, authenticated, service_role;
create table crm_private.bootstrap_state (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique,
  email text not null,
  full_name text not null check (length(trim(full_name)) between 1 and 200),
  organization_name text not null check (length(trim(organization_name)) between 1 and 200),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table crm_private.bootstrap_state enable row level security;
revoke all on crm_private.bootstrap_state from public, anon, authenticated, service_role;

create function crm_private.guard_bootstrap_state() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'DELETE' or OLD.completed_at is not null then
    raise exception 'First-Admin setup cannot be reset or reused';
  end if;
  if NEW.user_id <> OLD.user_id or NEW.email <> OLD.email
     or NEW.full_name <> OLD.full_name or NEW.organization_name <> OLD.organization_name then
    raise exception 'Pending setup identity cannot be changed';
  end if;
  return NEW;
end $$;
revoke all on function crm_private.guard_bootstrap_state() from public, anon, authenticated, service_role;
create trigger bootstrap_state_guard before update or delete on crm_private.bootstrap_state
  for each row execute function crm_private.guard_bootstrap_state();
commit;
