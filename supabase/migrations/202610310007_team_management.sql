begin;
alter table public.organization_memberships add column revision integer not null default 1;
-- Organization deletion is an operator-only operation. This permits complete
-- removal of test-owned organizations while the guard protects every live org.
alter table public.organization_memberships drop constraint organization_memberships_organization_id_fkey;
alter table public.organization_memberships add constraint organization_memberships_organization_id_fkey
  foreign key(organization_id) references public.organizations(id) on delete cascade;

create function crm_private.guard_last_admin() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.organizations where id=OLD.organization_id for update;
  if not found then return OLD; end if;
  if TG_OP='UPDATE' and NEW.organization_id<>OLD.organization_id then
    raise exception 'Organization membership cannot be transferred' using errcode='42501';
  end if;
  if OLD.active and OLD.role='admin' and
    (TG_OP='DELETE' or not NEW.active or NEW.role<>'admin') and
    (select count(*) from public.organization_memberships where organization_id=OLD.organization_id and active and role='admin')<=1 then
    raise exception 'The last active Admin must remain active and Admin' using errcode='PT409';
  end if;
  if TG_OP='UPDATE' then NEW.revision=OLD.revision+1;return NEW; end if;
  return OLD;
end $$;
revoke all on function crm_private.guard_last_admin() from public,anon,authenticated,service_role;
create trigger membership_last_admin before update or delete on public.organization_memberships
  for each row execute function crm_private.guard_last_admin();

create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null,
  email text not null check(email=lower(trim(email)) and length(email)<=254),
  full_name text not null check(length(trim(full_name)) between 1 and 200),
  role public.staff_role not null,
  created_by uuid not null references auth.users(id),
  reserved_user_id uuid not null default gen_random_uuid(),
  delivery_state text not null default 'pending' check(delivery_state in ('pending','sent')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default now()+interval '72 hours',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  unique(organization_id,request_id)
);
create unique index team_invite_pending_email on public.team_invitations(organization_id,email) where accepted_at is null;
create table public.team_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  target_id uuid references auth.users(id),
  invitation_id uuid references public.team_invitations(id),
  action text not null,
  changed_at timestamptz not null default clock_timestamp(),
  changes jsonb not null
);
create index team_audit_org_time on public.team_audit_logs(organization_id,changed_at desc);
alter table public.team_invitations enable row level security;
alter table public.team_audit_logs enable row level security;
revoke all on public.team_invitations,public.team_audit_logs from public,anon,authenticated,service_role;

create function crm_private.team_admin_org(p_actor uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
  select organization_id into org from public.organization_memberships where user_id=p_actor;
  if org is null then raise exception 'Admin access required' using errcode='42501';end if;
  perform 1 from public.organizations where id=org for update;
  if not exists(select 1 from public.organization_memberships where user_id=p_actor and organization_id=org and active and role='admin') then
    raise exception 'Admin access required' using errcode='42501';end if;
  return org;
end $$;
revoke all on function crm_private.team_admin_org(uuid) from public,anon,authenticated,service_role;

create function public.team_list() returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
  org=crm_private.team_admin_org(auth.uid());
  return jsonb_build_object(
    'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.full_name,'email',u.email,'role',m.role,'active',m.active,'revision',m.revision) order by p.full_name,m.user_id)
      from public.organization_memberships m join public.staff_profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id where m.organization_id=org),'[]'::jsonb),
    'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.full_name,'email',i.email,'role',i.role,'delivery',i.delivery_state,'expires_at',i.expires_at) order by i.created_at desc)
      from public.team_invitations i where i.organization_id=org and i.accepted_at is null),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(to_jsonb(a)) from (select l.action,l.changed_at,l.changes,coalesce(p.full_name,'Unavailable staff member') actor,coalesce(t.full_name,'Invitation recipient') target
      from public.team_audit_logs l left join public.staff_profiles p on p.id=l.actor_id left join public.staff_profiles t on t.id=l.target_id where l.organization_id=org order by l.changed_at desc,l.id desc limit 50) a),'[]'::jsonb)
  );
end $$;
revoke all on function public.team_list() from public,anon;
grant execute on function public.team_list() to authenticated;

-- These functions trust only server-supplied, Auth-verified actor IDs. Browser
-- tokens cannot execute them, even when the caller is an organization Admin.
create function public.team_reserve_invitation(p_actor uuid,p_request uuid,p_email text,p_name text,p_role public.staff_role)
returns public.team_invitations language plpgsql security definer set search_path='' as $$
declare org uuid;inv public.team_invitations;
begin
  org=crm_private.team_admin_org(p_actor);
  if length(trim(p_name)) not between 1 and 200 or length(p_email)>254 or p_email<>lower(trim(p_email)) or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid invitation details' using errcode='22023';end if;
  select * into inv from public.team_invitations where organization_id=org and request_id=p_request;
  if found then
    if inv.email<>p_email or inv.full_name<>p_name or inv.role<>p_role then raise exception 'Retry details differ; start a new invitation' using errcode='PT409';end if;
    return inv;
  end if;
  if exists(select 1 from public.organization_memberships m join auth.users u on u.id=m.user_id where m.organization_id=org and lower(u.email)=p_email) then
    raise exception 'Already a member of this team' using errcode='PT409';end if;
  select * into inv from public.team_invitations where organization_id=org and email=p_email and accepted_at is null;
  if found then
    if inv.full_name<>p_name or inv.role<>p_role then raise exception 'A pending invitation already exists; retry it from Team' using errcode='PT409';end if;
    return inv;
  end if;
  insert into public.team_invitations(organization_id,request_id,email,full_name,role,created_by)
    values(org,p_request,p_email,p_name,p_role,p_actor) returning * into inv;
  insert into public.team_audit_logs(organization_id,actor_id,invitation_id,action,changes)
    values(org,p_actor,inv.id,'invitation_created',jsonb_build_object('role',inv.role,'access','pending ownership verification'));
  return inv;
end $$;
create function public.team_invitation_for_send(p_actor uuid,p_id uuid)
returns public.team_invitations language plpgsql security definer set search_path='' as $$
declare org uuid;inv public.team_invitations;
begin
  org=crm_private.team_admin_org(p_actor);
  select * into inv from public.team_invitations where id=p_id and organization_id=org for update;
  if not found or inv.accepted_at is not null then raise exception 'Invitation unavailable' using errcode='42501';end if;
  -- An explicit resend is a fresh grant approved by the current Admin. The
  -- deterministic token stays valid; no password or existing membership changes.
  update public.team_invitations set created_by=p_actor,expires_at=now()+interval '72 hours' where id=p_id returning * into inv;
  return inv;
end $$;
create function public.team_mark_sent(p_actor uuid,p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
  org=crm_private.team_admin_org(p_actor);
  update public.team_invitations set delivery_state='sent' where id=p_id and organization_id=org and delivery_state='pending' and accepted_at is null;
  if found then insert into public.team_audit_logs(organization_id,actor_id,invitation_id,action,changes)
    values(org,p_actor,p_id,'invitation_mail_accepted','{"delivery":"SMTP accepted; inbox delivery unconfirmed"}');end if;
end $$;
create function public.team_get_invitation(p_id uuid) returns public.team_invitations
language sql security definer set search_path='' as $$
  select i from public.team_invitations i where id=p_id and expires_at>now() and delivery_state='sent'
$$;
create function public.team_accept_invitation(p_id uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare inv public.team_invitations;org uuid;actual_email text;
begin
  select organization_id into org from public.team_invitations where id=p_id;
  if org is null then raise exception 'Invitation unavailable' using errcode='42501';end if;
  perform 1 from public.organizations where id=org for update;
  select * into inv from public.team_invitations where id=p_id for update;
  if inv.expires_at<=now() or inv.delivery_state<>'sent' then raise exception 'Invitation unavailable' using errcode='42501';end if;
  select lower(email) into actual_email from auth.users where id=p_user and email_confirmed_at is not null;
  if actual_email is distinct from inv.email then raise exception 'Verified account ownership required' using errcode='42501';end if;
  if inv.accepted_at is not null then
    if inv.accepted_by=p_user then return jsonb_build_object('accepted',true);end if;
    raise exception 'Invitation unavailable' using errcode='42501';
  end if;
  if not exists(select 1 from public.organization_memberships where user_id=inv.created_by and organization_id=org and role='admin' and active) then
    raise exception 'Invitation requires renewed Admin approval' using errcode='42501';end if;
  if exists(select 1 from public.organization_memberships where user_id=p_user) then raise exception 'This account cannot join this team' using errcode='42501';end if;
  insert into public.staff_profiles(id,full_name) values(p_user,inv.full_name) on conflict(id) do nothing;
  insert into public.organization_memberships(user_id,organization_id,role) values(p_user,org,inv.role);
  update public.team_invitations set accepted_at=clock_timestamp(),accepted_by=p_user where id=p_id;
  insert into public.team_audit_logs(organization_id,actor_id,target_id,invitation_id,action,changes)
    values(org,p_user,p_user,p_id,'invitation_accepted',jsonb_build_object('invited_by',inv.created_by,'role',inv.role,'active',true));
  return jsonb_build_object('accepted',true);
end $$;
create function public.team_update_member(p_actor uuid,p_target uuid,p_role public.staff_role,p_active boolean,p_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;previous public.organization_memberships;updated public.organization_memberships;
begin
  org=crm_private.team_admin_org(p_actor);
  select * into previous from public.organization_memberships where user_id=p_target and organization_id=org for update;
  if not found then raise exception 'Team member unavailable' using errcode='42501';end if;
  if p_role is null or p_active is null or p_revision is distinct from previous.revision then raise exception 'Reload Team before saving' using errcode='PT409';end if;
  if previous.role=p_role and previous.active=p_active then return to_jsonb(previous);end if;
  update public.organization_memberships set role=p_role,active=p_active where user_id=p_target and organization_id=org returning * into updated;
  insert into public.team_audit_logs(organization_id,actor_id,target_id,action,changes)
    values(org,p_actor,p_target,'membership_updated',jsonb_build_object('before',jsonb_build_object('role',previous.role,'active',previous.active),'after',jsonb_build_object('role',updated.role,'active',updated.active)));
  return to_jsonb(updated);
end $$;
revoke all on function public.team_reserve_invitation(uuid,uuid,text,text,public.staff_role),public.team_invitation_for_send(uuid,uuid),public.team_mark_sent(uuid,uuid),public.team_get_invitation(uuid),public.team_accept_invitation(uuid,uuid),public.team_update_member(uuid,uuid,public.staff_role,boolean,integer) from public,anon,authenticated;
grant execute on function public.team_reserve_invitation(uuid,uuid,text,text,public.staff_role),public.team_invitation_for_send(uuid,uuid),public.team_mark_sent(uuid,uuid),public.team_get_invitation(uuid),public.team_accept_invitation(uuid,uuid),public.team_update_member(uuid,uuid,public.staff_role,boolean,integer) to service_role;
commit;
