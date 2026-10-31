begin;
-- Explicitly reject missing leases at the database boundary.
create or replace function public.manual_claim_invitation(p_id uuid,p_hash text,p_username text,p_lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare inv public.manual_team_invitations;org uuid;identity_row crm_private.staff_usernames;
begin
 if p_lease is null then raise exception 'Invalid setup lease' using errcode='22023';end if;
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
create or replace function public.manual_finish_invitation(p_id uuid,p_lease uuid) returns void
language plpgsql security definer set search_path='' as $$
declare inv public.manual_team_invitations;identity_row crm_private.staff_usernames;org uuid;
begin
 select organization_id into org from public.manual_team_invitations where id=p_id;
 perform 1 from public.organizations where id=org for update;
 select * into inv from public.manual_team_invitations where id=p_id for update;
 if p_lease is null or inv.lease_until is null or not found or inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at<=now() or inv.lease_id is distinct from p_lease or inv.lease_until<=now() then raise exception 'Invitation unavailable' using errcode='42501';end if;
 if not exists(select 1 from public.organization_memberships where user_id=inv.created_by and organization_id=org and role='admin' and active) then raise exception 'Admin approval unavailable' using errcode='42501';end if;
 select * into identity_row from crm_private.staff_usernames where invitation_id=p_id;
 if not found or not exists(select 1 from auth.users where id=identity_row.user_id and email=identity_row.internal_email and email_confirmed_at is not null) then raise exception 'Account setup incomplete' using errcode='42501';end if;
 insert into public.staff_profiles(id,full_name) values(identity_row.user_id,inv.full_name);
 insert into public.organization_memberships(user_id,organization_id,role) values(identity_row.user_id,org,inv.role);
 update crm_private.staff_usernames set enabled=true where invitation_id=p_id;
 update public.manual_team_invitations set accepted_at=clock_timestamp(),lease_id=null,lease_until=null where id=p_id;
 insert into public.team_audit_logs(organization_id,actor_id,target_id,action,changes) values(org,identity_row.user_id,identity_row.user_id,'manual_invitation_accepted',jsonb_build_object('invitation_id',p_id,'invited_by',inv.created_by,'role',inv.role));
end $$;
create index team_rate_limits_window_idx on crm_private.team_rate_limits(window_start);
commit;
