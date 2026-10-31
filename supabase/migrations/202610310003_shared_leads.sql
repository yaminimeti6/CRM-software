begin;
create function public.lead_organization() returns uuid
language sql stable security definer set search_path = '' as $$
  select organization_id from public.organization_memberships
  where user_id=auth.uid() and active and role in ('admin','manager','telecaller')
$$;
revoke all on function public.lead_organization() from public, anon;
grant execute on function public.lead_organization() to authenticated;

create table public.lead_statuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 80 and lower(label) not like '%confirm%'),
  is_new boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  unique (organization_id,id), unique(organization_id,label),
  check (not is_new or active)
);
create unique index lead_statuses_one_new on public.lead_statuses(organization_id) where is_new;
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (length(trim(name)) between 1 and 200),
  mobile_no text not null check (length(mobile_no) between 6 and 25 and mobile_no ~ '^\+?[0-9 ()-]+$' and length(regexp_replace(mobile_no,'[^0-9]','','g')) between 6 and 20),
  address text not null default '' check (length(address)<=2000),
  notes text not null default '' check (length(notes)<=4000),
  answers jsonb not null default '{}' check (jsonb_typeof(answers)='object' and octet_length(answers::text)<=30000),
  status_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references auth.users(id),
  version integer not null default 1 check (version>0),
  unique(organization_id,id),
  foreign key(organization_id,status_id) references public.lead_statuses(organization_id,id)
);
create index leads_org_created_idx on public.leads(organization_id,created_at desc,id desc);
create index leads_org_status_idx on public.leads(organization_id,status_id,created_at desc);
create table public.lead_field_definitions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  field_key text not null check(length(trim(field_key)) between 1 and 80),
  created_at timestamptz not null default clock_timestamp(),
  primary key(organization_id,field_key)
);
create table public.lead_edit_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lead_id uuid not null,
  editor_id uuid not null references auth.users(id),
  edited_at timestamptz not null default clock_timestamp(),
  version integer not null,
  changes jsonb not null,
  foreign key(organization_id,lead_id) references public.leads(organization_id,id) on delete cascade,
  unique(lead_id,version)
);
create index lead_history_lookup on public.lead_edit_history(organization_id,lead_id,version desc);
alter table public.lead_statuses enable row level security;
alter table public.leads enable row level security;
alter table public.lead_field_definitions enable row level security;
alter table public.lead_edit_history enable row level security;
revoke all on public.lead_statuses, public.leads, public.lead_field_definitions, public.lead_edit_history from public, anon, authenticated;
grant select on public.lead_statuses, public.leads, public.lead_field_definitions, public.lead_edit_history to authenticated;
create policy statuses_read on public.lead_statuses for select to authenticated using (organization_id=(select public.lead_organization()));
create policy leads_read on public.leads for select to authenticated using (organization_id=(select public.lead_organization()));
create policy fields_read on public.lead_field_definitions for select to authenticated using (organization_id=(select public.lead_organization()));
create policy history_read on public.lead_edit_history for select to authenticated using (organization_id=(select public.lead_organization()));
-- Admin configuration is limited to presentation and activation. A New status
-- cannot be disabled. Confirmation statuses are deliberately forbidden in Step 2.
grant update(label,active,sort_order) on public.lead_statuses to authenticated;
create policy statuses_admin on public.lead_statuses for update to authenticated
  using (exists(select 1 from public.organization_memberships m where m.user_id=auth.uid() and m.active and m.role='admin' and m.organization_id=lead_statuses.organization_id))
  with check (exists(select 1 from public.organization_memberships m where m.user_id=auth.uid() and m.active and m.role='admin' and m.organization_id=lead_statuses.organization_id));

insert into public.lead_statuses(organization_id,label,is_new,sort_order)
select id,'New',true,0 from public.organizations;
insert into public.lead_statuses(organization_id,label,sort_order)
select id,'Retry',10 from public.organizations;
create function crm_private.seed_lead_statuses() returns trigger language plpgsql set search_path='' as $$
begin
  insert into public.lead_statuses(organization_id,label,is_new,sort_order) values (NEW.id,'New',true,0),(NEW.id,'Retry',false,10);
  return NEW;
end $$;
revoke all on function crm_private.seed_lead_statuses() from public,anon,authenticated;
create trigger organization_lead_statuses after insert on public.organizations for each row execute function crm_private.seed_lead_statuses();

create function crm_private.validate_lead_input(p_input jsonb) returns void
language plpgsql set search_path='' as $$
declare pair record;
begin
  if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>40000 then raise exception 'Invalid lead payload' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(p_input) k where k not in ('name','mobile_no','address','notes','answers','status_id')) then raise exception 'Protected or unknown field' using errcode='22023'; end if;
  if jsonb_typeof(p_input->'name') is distinct from 'string' or jsonb_typeof(p_input->'mobile_no') is distinct from 'string'
    or (p_input ? 'address' and jsonb_typeof(p_input->'address')<>'string')
    or (p_input ? 'notes' and jsonb_typeof(p_input->'notes')<>'string')
    or jsonb_typeof(coalesce(p_input->'answers','{}')) is distinct from 'object' then raise exception 'Invalid lead field types' using errcode='22023'; end if;
  if (select count(*) from jsonb_object_keys(coalesce(p_input->'answers','{}'))) > 30 then raise exception 'Too many dynamic fields' using errcode='22023'; end if;
  for pair in select key,value from jsonb_each(coalesce(p_input->'answers','{}')) loop
    if length(trim(pair.key)) not between 1 and 80 or jsonb_typeof(pair.value)<>'string' or length(pair.value#>>'{}')>1000 then raise exception 'Invalid dynamic field' using errcode='22023'; end if;
  end loop;
end $$;
revoke all on function crm_private.validate_lead_input(jsonb) from public,anon,authenticated;

create function crm_private.record_lead_edit() returns trigger language plpgsql set search_path='' as $$
declare delta jsonb; previous jsonb;
begin
  if TG_OP='INSERT' then previous='{}'; else previous=to_jsonb(OLD); end if;
  select coalesce(jsonb_object_agg(k,jsonb_build_object('before',previous->k,'after',to_jsonb(NEW)->k)),'{}') into delta
    from unnest(array['name','mobile_no','address','notes','answers','status_id']) k
    where (previous->k) is distinct from (to_jsonb(NEW)->k);
  insert into public.lead_edit_history(organization_id,lead_id,editor_id,version,changes)
    values(NEW.organization_id,NEW.id,auth.uid(),NEW.version,delta);
  insert into public.lead_field_definitions(organization_id,field_key)
    select NEW.organization_id,key from jsonb_object_keys(NEW.answers) key on conflict do nothing;
  return NEW;
end $$;
revoke all on function crm_private.record_lead_edit() from public,anon,authenticated;
create trigger lead_edit_audit after insert or update on public.leads for each row execute function crm_private.record_lead_edit();

create function public.create_lead(p_input jsonb) returns public.leads
language plpgsql security definer set search_path='' as $$
declare org uuid; initial uuid; result public.leads;
begin
  org=public.lead_organization();
  if org is null then raise exception 'Operational staff required' using errcode='42501'; end if;
  perform crm_private.validate_lead_input(p_input);
  if p_input ? 'status_id' then raise exception 'New leads use the configured New status' using errcode='22023'; end if;
  select id into initial from public.lead_statuses where organization_id=org and is_new and active;
  if initial is null then raise exception 'New status is not configured' using errcode='22023'; end if;
  insert into public.leads(organization_id,name,mobile_no,address,notes,answers,status_id,created_by)
    values(org,trim(p_input->>'name'),trim(p_input->>'mobile_no'),coalesce(p_input->>'address',''),coalesce(p_input->>'notes',''),coalesce(p_input->'answers','{}'),initial,auth.uid()) returning * into result;
  return result;
end $$;
create function public.update_lead(p_id uuid,p_version integer,p_input jsonb) returns public.leads
language plpgsql security definer set search_path='' as $$
declare org uuid; current_lead public.leads; result public.leads; target_status uuid;
begin
  org=public.lead_organization();
  if org is null then raise exception 'Operational staff required' using errcode='42501'; end if;
  perform crm_private.validate_lead_input(p_input);
  select * into current_lead from public.leads where id=p_id and organization_id=org for update;
  if not found then raise exception 'Lead unavailable' using errcode='42501'; end if;
  if p_version is null or current_lead.version<>p_version then raise exception 'Lead changed. Reload before editing.' using errcode='40001'; end if;
  target_status=coalesce((p_input->>'status_id')::uuid,current_lead.status_id);
  if not exists(select 1 from public.lead_statuses where id=target_status and organization_id=org and (active or id=current_lead.status_id)) then raise exception 'Status unavailable' using errcode='22023'; end if;
  if current_lead.name=trim(p_input->>'name') and current_lead.mobile_no=trim(p_input->>'mobile_no')
    and current_lead.address=coalesce(p_input->>'address','') and current_lead.notes=coalesce(p_input->>'notes','')
    and current_lead.answers=coalesce(p_input->'answers','{}') and current_lead.status_id=target_status then return current_lead; end if;
  update public.leads set name=trim(p_input->>'name'),mobile_no=trim(p_input->>'mobile_no'),address=coalesce(p_input->>'address',''),notes=coalesce(p_input->>'notes',''),answers=coalesce(p_input->'answers','{}'),status_id=target_status,version=version+1,updated_at=clock_timestamp()
    where id=p_id and organization_id=org returning * into result;
  return result;
end $$;
revoke all on function public.create_lead(jsonb),public.update_lead(uuid,integer,jsonb) from public,anon;
grant execute on function public.create_lead(jsonb),public.update_lead(uuid,integer,jsonb) to authenticated;
commit;
