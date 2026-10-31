begin;

create type public.staff_role as enum ('admin', 'manager', 'telecaller', 'creative_analyst');
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  created_at timestamptz not null default now()
);
create table public.staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 200),
  created_at timestamptz not null default now()
);
create table public.organization_memberships (
  -- One organization per staff account in Step 1. Avoid ambiguous tenant selection.
  user_id uuid primary key references public.staff_profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  role public.staff_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index organization_memberships_org_idx on public.organization_memberships(organization_id);

alter table public.organizations enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.organization_memberships enable row level security;

-- No client writes, including Admin clients. Provision through a trusted operator
-- until an audited administrative management slice is implemented.
revoke all on public.organizations, public.staff_profiles, public.organization_memberships from public, anon, authenticated;
grant select on public.organizations, public.staff_profiles, public.organization_memberships to authenticated;
grant usage on type public.staff_role to authenticated;
grant all on public.organizations, public.staff_profiles, public.organization_memberships to service_role;

create policy membership_read_self on public.organization_memberships
  for select to authenticated using (user_id = (select auth.uid()) and active);
create policy profile_read_self on public.staff_profiles
  for select to authenticated using (
    id = (select auth.uid()) and exists (
      select 1 from public.organization_memberships m where m.user_id = (select auth.uid()) and m.active
    )
  );
create policy organization_read_own on public.organizations
  for select to authenticated using (
    exists (select 1 from public.organization_memberships m
      where m.user_id = (select auth.uid()) and m.organization_id = organizations.id and m.active)
  );

-- No trigger uses raw_user_meta_data: users can change that metadata themselves.
-- No public provisioning function, automatic signup profile or role mutation RPC.
commit;
