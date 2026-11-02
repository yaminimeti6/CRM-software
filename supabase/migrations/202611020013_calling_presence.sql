begin;
create table public.calling_presence(
 organization_id uuid not null,lead_id uuid not null,caller_id uuid not null references auth.users(id),session_id uuid not null,tab_id uuid not null,generation uuid not null,
 sequence integer not null check(sequence>0),command text not null,active boolean not null,started_at timestamptz not null,expires_at timestamptz not null,
 primary key(organization_id,lead_id,caller_id,session_id,tab_id),foreign key(organization_id,lead_id) references public.leads(organization_id,id) on delete cascade
);
alter table public.calling_presence enable row level security;
revoke all on public.calling_presence from public,anon,authenticated;
-- No direct table reads: authentication session identifiers remain private.
create function crm_private.calling_session() returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid;begin
 sid=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id';
 if sid is null or not exists(select 1 from auth.sessions where id=sid and user_id=auth.uid()) then raise exception 'Live authentication session required' using errcode='42501';end if;
 return sid;
end $$;
revoke all on function crm_private.calling_session() from public,anon,authenticated,service_role;
create function public.set_calling_presence(p_lead uuid,p_tab uuid,p_generation uuid,p_sequence integer,p_command text) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=public.lead_organization();actor uuid:=auth.uid();sid uuid;old public.calling_presence;moment timestamptz:=clock_timestamp();begin
 if org is null then raise exception 'Operational staff required' using errcode='42501';end if;
 sid=crm_private.calling_session();
 if p_tab is null or p_generation is null or p_sequence is null or p_sequence<1 or p_command is null or p_command not in('start','heartbeat','stop') then raise exception 'Invalid presence command' using errcode='22023';end if;
 if not exists(select 1 from public.leads where id=p_lead and organization_id=org) then raise exception 'Lead unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('calling'||org::text||actor::text||sid::text||p_tab::text||p_lead::text,0));
 select * into old from public.calling_presence where organization_id=org and lead_id=p_lead and caller_id=actor and session_id=sid and tab_id=p_tab for update;
 if found and p_sequence<=old.sequence then
  if p_sequence=old.sequence and p_generation=old.generation and p_command=old.command then return jsonb_build_object('active',old.active and old.expires_at>moment,'expires_at',old.expires_at,'replayed',true);end if;
  raise exception 'Stale calling command' using errcode='PT409';
 end if;
 if p_command='heartbeat' and (old.caller_id is null or not old.active or old.expires_at<=moment or old.generation<>p_generation) then return jsonb_build_object('active',false);end if;
 if p_command='stop' and old.caller_id is not null and old.generation<>p_generation then raise exception 'Stale calling generation' using errcode='PT409';end if;
 insert into public.calling_presence values(org,p_lead,actor,sid,p_tab,p_generation,p_sequence,p_command,p_command<>'stop',case when p_command='start' or old.started_at is null then moment else old.started_at end,case when p_command='stop' then moment else moment+interval '60 seconds' end)
 on conflict(organization_id,lead_id,caller_id,session_id,tab_id) do update set generation=excluded.generation,sequence=excluded.sequence,command=excluded.command,active=excluded.active,started_at=excluded.started_at,expires_at=excluded.expires_at;
 return jsonb_build_object('active',p_command<>'stop','expires_at',case when p_command='stop' then moment else moment+interval '60 seconds' end);
end $$;
revoke all on function public.set_calling_presence(uuid,uuid,uuid,integer,text) from public,anon;grant execute on function public.set_calling_presence(uuid,uuid,uuid,integer,text) to authenticated;
create function public.list_calling_presence(p_leads uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=public.lead_organization();begin
 if org is null then raise exception 'Operational staff required' using errcode='42501';end if;
 perform crm_private.calling_session();
 if p_leads is null or cardinality(p_leads)>50 then raise exception 'At most 50 leads' using errcode='22023';end if;
 if exists(select 1 from unnest(p_leads) x where not exists(select 1 from public.leads l where l.id=x and l.organization_id=org)) then raise exception 'Lead unavailable' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(v)) from(
 select c.lead_id,c.caller_id,p.full_name caller,min(c.started_at) started_at,max(c.expires_at) expires_at,count(*) tabs
 from public.calling_presence c join public.staff_profiles p on p.id=c.caller_id join public.organization_memberships m on m.user_id=c.caller_id and m.organization_id=c.organization_id
 where c.organization_id=org and c.lead_id=any(p_leads) and c.active and c.expires_at>clock_timestamp() and m.active and m.role in('admin','manager','telecaller') and exists(select 1 from auth.sessions s where s.id=c.session_id and s.user_id=c.caller_id)
 group by c.lead_id,c.caller_id,p.full_name)v),'[]'::jsonb);
end $$;
revoke all on function public.list_calling_presence(uuid[]) from public,anon;grant execute on function public.list_calling_presence(uuid[]) to authenticated;
create function public.stop_my_calling_session() returns void language plpgsql security definer set search_path='' as $$
declare sid uuid:=crm_private.calling_session();begin
 update public.calling_presence set active=false,expires_at=clock_timestamp(),sequence=sequence+1,command='stop' where caller_id=auth.uid() and session_id=sid;
end $$;
revoke all on function public.stop_my_calling_session() from public,anon;grant execute on function public.stop_my_calling_session() to authenticated;
create function crm_private.clear_inactive_calling() returns trigger language plpgsql security definer set search_path='' as $$begin
 if not new.active or new.role not in('admin','manager','telecaller') then update public.calling_presence set active=false,expires_at=clock_timestamp(),sequence=sequence+1,command='stop' where caller_id=new.user_id and organization_id=new.organization_id;end if;return new;
end $$;
revoke all on function crm_private.clear_inactive_calling() from public,anon,authenticated,service_role;
create trigger clear_inactive_calling after update of active,role on public.organization_memberships for each row execute function crm_private.clear_inactive_calling();
notify pgrst,'reload schema';commit;
