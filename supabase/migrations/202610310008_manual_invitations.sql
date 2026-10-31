begin;
create table public.manual_team_invitations (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 request_id uuid not null,full_name text not null check(length(trim(full_name)) between 1 and 200),role public.staff_role not null,
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),created_by uuid not null references auth.users(id),
 reserved_user_id uuid not null default gen_random_uuid(),created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default now()+interval '48 hours',revoked_at timestamptz,accepted_at timestamptz,
 lease_id uuid,lease_until timestamptz,unique(organization_id,request_id)
);
alter table public.manual_team_invitations enable row level security;
revoke all on public.manual_team_invitations from public,anon,authenticated,service_role;
create table crm_private.staff_usernames (
 username text primary key check(username ~ '^[a-z][a-z0-9_]{2,31}$'),
 user_id uuid not null unique,invitation_id uuid not null unique references public.manual_team_invitations(id) on delete cascade,
 internal_email text not null unique,enabled boolean not null default false
);
revoke all on crm_private.staff_usernames from public,anon,authenticated,service_role;
create table crm_private.team_rate_limits(bucket text primary key,window_start timestamptz not null,hits integer not null);
revoke all on crm_private.team_rate_limits from public,anon,authenticated,service_role;

create function public.manual_rate_limit(p_bucket text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare count_hits integer;
begin
 if p_limit not between 1 and 1000 or p_seconds not between 1 and 3600 or length(p_bucket)>150 then return false;end if;
 insert into crm_private.team_rate_limits as r values(p_bucket,clock_timestamp(),1)
 on conflict(bucket) do update set hits=case when r.window_start<clock_timestamp()-make_interval(secs=>p_seconds) then 1 else r.hits+1 end,
 window_start=case when r.window_start<clock_timestamp()-make_interval(secs=>p_seconds) then clock_timestamp() else r.window_start end returning hits into count_hits;
 delete from crm_private.team_rate_limits where window_start<now()-interval '1 day';
 return count_hits<=p_limit;
end $$;
create function public.manual_create_invitation(p_actor uuid,p_request uuid,p_name text,p_role public.staff_role,p_hash text)
returns public.manual_team_invitations language plpgsql security definer set search_path='' as $$
declare org uuid;inv public.manual_team_invitations;
begin
 org=crm_private.team_admin_org(p_actor);
 select * into inv from public.manual_team_invitations where organization_id=org and request_id=p_request;
 if found then
  if inv.full_name<>trim(p_name) or inv.role<>p_role then raise exception 'Retry details differ' using errcode='PT409';end if;
  return inv;
 end if;
 insert into public.manual_team_invitations(organization_id,request_id,full_name,role,token_hash,created_by)
 values(org,p_request,trim(p_name),p_role,p_hash,p_actor) returning * into inv;
 insert into public.team_audit_logs(organization_id,actor_id,action,changes) values(org,p_actor,'manual_invitation_created',jsonb_build_object('invitation_id',inv.id,'role',inv.role));
 return inv;
end $$;
create function public.manual_revoke_invitation(p_actor uuid,p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare org uuid;inv public.manual_team_invitations;
begin
 org=crm_private.team_admin_org(p_actor);
 select * into inv from public.manual_team_invitations where id=p_id and organization_id=org for update;
 if not found then raise exception 'Invitation unavailable' using errcode='42501';end if;
 if inv.accepted_at is not null then raise exception 'Invitation already used' using errcode='PT409';end if;
 if inv.revoked_at is null then
  update public.manual_team_invitations set revoked_at=clock_timestamp(),lease_id=null,lease_until=null where id=p_id;
  delete from crm_private.staff_usernames where invitation_id=p_id and not enabled;
  insert into public.team_audit_logs(organization_id,actor_id,action,changes) values(org,p_actor,'manual_invitation_revoked',jsonb_build_object('invitation_id',p_id));
 end if;
end $$;
create function public.manual_validate_invitation(p_id uuid,p_hash text) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('name',i.full_name,'role',i.role,'state',case when accepted_at is not null then 'accepted' when revoked_at is not null then 'revoked' when expires_at<=now() then 'expired' else 'pending' end)
 from public.manual_team_invitations i where id=p_id and token_hash=p_hash
$$;
create function public.manual_claim_invitation(p_id uuid,p_hash text,p_username text,p_lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare inv public.manual_team_invitations;org uuid;identity_row crm_private.staff_usernames;
begin
 select organization_id into org from public.manual_team_invitations where id=p_id and token_hash=p_hash;
 if org is null then raise exception 'Invitation unavailable' using errcode='42501';end if;
 perform 1 from public.organizations where id=org for update;
 select * into inv from public.manual_team_invitations where id=p_id and token_hash=p_hash for update;
 if inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at<=now() then raise exception 'Invitation unavailable' using errcode='42501';end if;
 if not exists(select 1 from public.organization_memberships where user_id=inv.created_by and organization_id=org and active and role='admin') then raise exception 'Admin approval unavailable' using errcode='42501';end if;
 if inv.lease_until>now() then raise exception 'Setup is in progress. Retry shortly.' using errcode='PT409';end if;
 if p_username !~ '^[a-z][a-z0-9_]{2,31}$' then raise exception 'Invalid username' using errcode='22023';end if;
 delete from crm_private.staff_usernames u using public.manual_team_invitations i where u.invitation_id=i.id and not u.enabled and (i.revoked_at is not null or i.expires_at<=now());
 select * into identity_row from crm_private.staff_usernames where invitation_id=p_id;
 if found then
  if identity_row.username<>p_username then raise exception 'Resume using the originally chosen username' using errcode='PT409';end if;
 else
  begin
   insert into crm_private.staff_usernames(username,user_id,invitation_id,internal_email)
    values(p_username,inv.reserved_user_id,p_id,'staff-'||inv.reserved_user_id::text||'@crm.invalid') returning * into identity_row;
  exception when unique_violation then raise exception 'Username unavailable' using errcode='PT409';end;
 end if;
 update public.manual_team_invitations set lease_id=p_lease,lease_until=now()+interval '2 minutes' where id=p_id;
 return jsonb_build_object('user_id',identity_row.user_id,'email',identity_row.internal_email);
end $$;
create function public.manual_release_invitation(p_id uuid,p_lease uuid) returns void
language sql security definer set search_path='' as $$
 update public.manual_team_invitations set lease_id=null,lease_until=null where id=p_id and lease_id=p_lease and accepted_at is null
$$;
create function public.manual_finish_invitation(p_id uuid,p_lease uuid) returns void
language plpgsql security definer set search_path='' as $$
declare inv public.manual_team_invitations;identity_row crm_private.staff_usernames;org uuid;
begin
 select organization_id into org from public.manual_team_invitations where id=p_id;
 perform 1 from public.organizations where id=org for update;
 select * into inv from public.manual_team_invitations where id=p_id for update;
 if not found or inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at<=now() or inv.lease_id is distinct from p_lease or inv.lease_until<=now() then raise exception 'Invitation unavailable' using errcode='42501';end if;
 if not exists(select 1 from public.organization_memberships where user_id=inv.created_by and organization_id=org and role='admin' and active) then raise exception 'Admin approval unavailable' using errcode='42501';end if;
 select * into identity_row from crm_private.staff_usernames where invitation_id=p_id;
 if not found or not exists(select 1 from auth.users where id=identity_row.user_id and email=identity_row.internal_email and email_confirmed_at is not null) then raise exception 'Account setup incomplete' using errcode='42501';end if;
 insert into public.staff_profiles(id,full_name) values(identity_row.user_id,inv.full_name);
 insert into public.organization_memberships(user_id,organization_id,role) values(identity_row.user_id,org,inv.role);
 update crm_private.staff_usernames set enabled=true where invitation_id=p_id;
 update public.manual_team_invitations set accepted_at=clock_timestamp(),lease_id=null,lease_until=null where id=p_id;
 insert into public.team_audit_logs(organization_id,actor_id,target_id,action,changes) values(org,identity_row.user_id,identity_row.user_id,'manual_invitation_accepted',jsonb_build_object('invitation_id',p_id,'invited_by',inv.created_by,'role',inv.role));
end $$;
create function public.manual_login_identity(p_username text) returns text language sql security definer set search_path='' as $$
 select internal_email from crm_private.staff_usernames where username=p_username and enabled
$$;
create function public.own_username() returns text language sql stable security definer set search_path='' as $$
 select username from crm_private.staff_usernames where user_id=auth.uid() and enabled
$$;
revoke all on function public.own_username() from public,anon;
grant execute on function public.own_username() to authenticated;
revoke all on function public.manual_rate_limit(text,integer,integer),public.manual_create_invitation(uuid,uuid,text,public.staff_role,text),public.manual_revoke_invitation(uuid,uuid),public.manual_validate_invitation(uuid,text),public.manual_claim_invitation(uuid,text,text,uuid),public.manual_release_invitation(uuid,uuid),public.manual_finish_invitation(uuid,uuid),public.manual_login_identity(text) from public,anon,authenticated;
grant execute on function public.manual_rate_limit(text,integer,integer),public.manual_create_invitation(uuid,uuid,text,public.staff_role,text),public.manual_revoke_invitation(uuid,uuid),public.manual_validate_invitation(uuid,text),public.manual_claim_invitation(uuid,text,text,uuid),public.manual_release_invitation(uuid,uuid),public.manual_finish_invitation(uuid,uuid),public.manual_login_identity(text) to service_role;
create or replace function public.team_list() returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 org=crm_private.team_admin_org(auth.uid());
 return jsonb_build_object(
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.full_name,'email',case when n.user_id is null then u.email else null end,'username',n.username,'role',m.role,'active',m.active,'revision',m.revision) order by p.full_name,m.user_id)
 from public.organization_memberships m join public.staff_profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id left join crm_private.staff_usernames n on n.user_id=m.user_id and n.enabled where m.organization_id=org),'[]'::jsonb),
 'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.full_name,'role',i.role,'expires_at',i.expires_at,'state',case when i.accepted_at is not null then 'accepted' when i.revoked_at is not null then 'revoked' when i.expires_at<=now() then 'expired' else 'pending' end) order by i.created_at desc) from public.manual_team_invitations i where organization_id=org),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(to_jsonb(a)) from (select l.action,l.changed_at,l.changes,coalesce(p.full_name,'Unavailable staff member') actor,coalesce(t.full_name,'Invitation recipient') target from public.team_audit_logs l left join public.staff_profiles p on p.id=l.actor_id left join public.staff_profiles t on t.id=l.target_id where l.organization_id=org order by l.changed_at desc,l.id desc limit 50)a),'[]'::jsonb));
end $$;
commit;
