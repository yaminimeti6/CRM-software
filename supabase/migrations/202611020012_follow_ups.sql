begin;
create table public.follow_ups(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,lead_id uuid not null,
 due_at timestamptz not null check(isfinite(due_at) and due_at>='2000-01-01'::timestamptz and due_at<'2101-01-01'::timestamptz),
 notes text not null default '' check(length(notes)<=4000),created_by uuid not null references auth.users(id),assigned_to uuid references auth.users(id),
 state text not null default 'pending' check(state in('pending','completed','cancelled')),revision integer not null default 1 check(revision>0),
 call_attempt_id uuid unique references public.call_attempts(id),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 closed_at timestamptz,closed_by uuid references auth.users(id),foreign key(organization_id,lead_id) references public.leads(organization_id,id) on delete cascade,
 unique(organization_id,id),check((state='pending' and closed_at is null and closed_by is null) or (state<>'pending' and closed_at is not null and closed_by is not null))
);
create index follow_ups_due on public.follow_ups(organization_id,state,due_at,id);
create index follow_ups_lead on public.follow_ups(organization_id,lead_id,created_at desc);
create table public.follow_up_history(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,follow_up_id uuid not null,actor_id uuid not null references auth.users(id),
 occurred_at timestamptz not null default clock_timestamp(),revision integer not null,action text not null,
 before_data jsonb,after_data jsonb not null,unique(follow_up_id,revision),foreign key(organization_id,follow_up_id) references public.follow_ups(organization_id,id) on delete cascade
);
create table crm_private.follow_up_requests(organization_id uuid not null references public.organizations(id) on delete cascade,actor_id uuid not null,request_id uuid not null,kind text not null,payload jsonb not null,result jsonb not null,primary key(organization_id,actor_id,request_id));
revoke all on crm_private.follow_up_requests from public,anon,authenticated,service_role;
alter table public.follow_ups enable row level security;alter table public.follow_up_history enable row level security;
revoke all on public.follow_ups,public.follow_up_history from public,anon,authenticated;
grant select on public.follow_ups,public.follow_up_history to authenticated;
create policy followups_read on public.follow_ups for select to authenticated using(organization_id=(select public.lead_organization()));
create policy followup_history_read on public.follow_up_history for select to authenticated using(organization_id=(select public.lead_organization()));

create function crm_private.follow_up_snapshot(f public.follow_ups) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('due_at',f.due_at,'notes',f.notes,'state',f.state,'assigned_to',f.assigned_to,'assigned_name',coalesce((select p.full_name from public.staff_profiles p join public.organization_memberships m on m.user_id=p.id where p.id=f.assigned_to and m.organization_id=f.organization_id),'Unassigned'),'revision',f.revision)
$$;
revoke all on function crm_private.follow_up_snapshot(public.follow_ups) from public,anon,authenticated,service_role;
create function crm_private.mutate_follow_up(p_lead uuid,p_id uuid,p_revision integer,p_input jsonb,p_call uuid default null) returns public.follow_ups language plpgsql set search_path='' as $$
declare org uuid:=public.lead_organization();actor uuid:=auth.uid();old public.follow_ups;saved_row public.follow_ups;due timestamptz;assignee uuid;note text;state_value text;kind text;
begin
 if org is null then raise exception 'Operational staff required' using errcode='42501';end if;
 if p_revision is null or jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>30000 or exists(select 1 from jsonb_object_keys(p_input) k where k not in('due_at','notes','assigned_to','state')) then raise exception 'Invalid callback input' using errcode='22023';end if;
 if jsonb_typeof(p_input->'due_at') is distinct from 'string' or (p_input->>'due_at') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$' or (p_input?'notes' and jsonb_typeof(p_input->'notes')<>'string') or (p_input?'assigned_to' and jsonb_typeof(p_input->'assigned_to') not in('string','null')) or (p_input?'state' and jsonb_typeof(p_input->'state')<>'string') then raise exception 'Invalid callback types' using errcode='22023';end if;
 due=(p_input->>'due_at')::timestamptz;note=coalesce(p_input->>'notes','');assignee=nullif(p_input->>'assigned_to','')::uuid;state_value=coalesce(p_input->>'state','pending');
 if not isfinite(due) or due<'2000-01-01'::timestamptz or due>='2101-01-01'::timestamptz or length(note)>4000 or state_value not in('pending','completed','cancelled') then raise exception 'Invalid callback details' using errcode='22023';end if;
 perform 1 from public.leads where id=p_lead and organization_id=org for update;
 if not found then raise exception 'Lead unavailable' using errcode='42501';end if;
 if assignee is not null and not exists(select 1 from public.organization_memberships where user_id=assignee and organization_id=org and active and role in('admin','manager','telecaller')) then raise exception 'Choose an active operational assignee' using errcode='22023';end if;
 if p_id is null then
  if p_revision<>0 or state_value<>'pending' then raise exception 'New callback must be pending' using errcode='22023';end if;
  insert into public.follow_ups(organization_id,lead_id,due_at,notes,created_by,assigned_to,call_attempt_id) values(org,p_lead,due,note,actor,assignee,p_call) returning * into saved_row;kind='scheduled';
 else
  select * into old from public.follow_ups where id=p_id and lead_id=p_lead and organization_id=org for update;
  if not found then raise exception 'Callback unavailable' using errcode='42501';end if;
  if old.revision<>p_revision then raise exception 'Callback changed. Reload before saving.' using errcode='PT409';end if;
  if old.due_at=due and old.notes=note and old.assigned_to is not distinct from assignee and old.state=state_value then return old;end if;
  if old.state<>'pending' then raise exception 'Closed callback is immutable; schedule another' using errcode='22023';end if;
  update public.follow_ups set due_at=due,notes=note,assigned_to=assignee,state=state_value,revision=revision+1,updated_at=clock_timestamp(),closed_at=case when state_value<>'pending' then clock_timestamp() else null end,closed_by=case when state_value<>'pending' then actor else null end where id=old.id returning * into saved_row;
  kind=case when state_value='completed' then 'completed' when state_value='cancelled' then 'cancelled' when due<>old.due_at then 'rescheduled' else 'updated' end;
 end if;
 insert into public.follow_up_history(organization_id,follow_up_id,actor_id,revision,action,before_data,after_data) values(org,saved_row.id,actor,saved_row.revision,kind,case when p_id is null then null else crm_private.follow_up_snapshot(old) end,crm_private.follow_up_snapshot(saved_row));
 return saved_row;
end $$;
revoke all on function crm_private.mutate_follow_up(uuid,uuid,integer,jsonb,uuid) from public,anon,authenticated,service_role;

create function public.save_follow_up(p_lead uuid,p_id uuid,p_revision integer,p_request uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=public.lead_organization();actor uuid:=auth.uid();receipt crm_private.follow_up_requests;payload jsonb;row public.follow_ups;result jsonb;
begin
 if org is null then raise exception 'Operational staff required' using errcode='42501';end if;
 if p_request is null then raise exception 'Request required' using errcode='22023';end if;
 payload=jsonb_build_object('lead',p_lead,'id',p_id,'revision',p_revision,'input',p_input);
 perform pg_advisory_xact_lock(hashtextextended('follow-up'||org::text||actor::text||p_request::text,0));
 select * into receipt from crm_private.follow_up_requests where organization_id=org and actor_id=actor and request_id=p_request;
 if found then if receipt.kind<>'follow_up' or receipt.payload<>payload then raise exception 'Request used with different details' using errcode='PT409';end if;return receipt.result||'{"replayed":true}'::jsonb;end if;
 if exists(select 1 from public.call_attempts where organization_id=org and caller_id=actor and request_id=p_request) then raise exception 'Request already used for call only' using errcode='PT409';end if;
 row=crm_private.mutate_follow_up(p_lead,p_id,p_revision,p_input);result=jsonb_build_object('follow_up',to_jsonb(row),'replayed',false);
 insert into crm_private.follow_up_requests values(org,actor,p_request,'follow_up',payload,result);return result;
end $$;
revoke all on function public.save_follow_up(uuid,uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.save_follow_up(uuid,uuid,integer,uuid,jsonb) to authenticated;

-- Preserve the applied Step 4 implementation; wrap it without changing its
-- caller/version semantics. Reusing a combined request as a call-only request fails.
alter function public.log_lead_call(uuid,integer,uuid,jsonb) rename to log_lead_call_v4;
alter function public.log_lead_call_v4(uuid,integer,uuid,jsonb) set schema crm_private;
revoke all on function crm_private.log_lead_call_v4(uuid,integer,uuid,jsonb) from public,anon,authenticated,service_role;
create function public.log_lead_call(p_id uuid,p_version integer,p_request uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=public.lead_organization();begin
 if org is null then raise exception 'Operational staff required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('follow-up'||org::text||auth.uid()::text||p_request::text,0));
 if exists(select 1 from crm_private.follow_up_requests where organization_id=org and actor_id=auth.uid() and request_id=p_request) then raise exception 'Request already used for callback operation' using errcode='PT409';end if;
 return crm_private.log_lead_call_v4(p_id,p_version,p_request,p_input);
end $$;
revoke all on function public.log_lead_call(uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.log_lead_call(uuid,integer,uuid,jsonb) to authenticated;
create function public.log_call_with_follow_up(p_id uuid,p_version integer,p_request uuid,p_call jsonb,p_follow_up jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=public.lead_organization();actor uuid:=auth.uid();payload jsonb;receipt crm_private.follow_up_requests;result jsonb;callback public.follow_ups;
begin
 if org is null then raise exception 'Operational staff required' using errcode='42501';end if;
 if p_request is null then raise exception 'Request required' using errcode='22023';end if;
 payload=jsonb_build_object('id',p_id,'version',p_version,'call',p_call,'follow_up',p_follow_up);
 perform pg_advisory_xact_lock(hashtextextended('follow-up'||org::text||actor::text||p_request::text,0));
 select * into receipt from crm_private.follow_up_requests where organization_id=org and actor_id=actor and request_id=p_request;
 if found then if receipt.kind<>'call_follow_up' or receipt.payload<>payload then raise exception 'Request used with different details' using errcode='PT409';end if;return receipt.result||'{"replayed":true}'::jsonb;end if;
 if exists(select 1 from public.call_attempts where organization_id=org and caller_id=actor and request_id=p_request) then raise exception 'Request already used for call only' using errcode='PT409';end if;
 result=crm_private.log_lead_call_v4(p_id,p_version,p_request,p_call);
 callback=crm_private.mutate_follow_up(p_id,null,0,p_follow_up,(result->>'attempt_id')::uuid);
 result=result||jsonb_build_object('follow_up_id',callback.id);
 insert into crm_private.follow_up_requests values(org,actor,p_request,'call_follow_up',payload,result);return result;
end $$;
revoke all on function public.log_call_with_follow_up(uuid,integer,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.log_call_with_follow_up(uuid,integer,uuid,jsonb,jsonb) to authenticated;

create function public.follow_up_staff() returns table(id uuid,name text,role public.staff_role) language sql stable security definer set search_path='' as $$
 select p.id,p.full_name,m.role from public.staff_profiles p join public.organization_memberships m on m.user_id=p.id where m.organization_id=public.lead_organization() and m.active and m.role in('admin','manager','telecaller') order by p.full_name,p.id
$$;
revoke all on function public.follow_up_staff() from public,anon;grant execute on function public.follow_up_staff() to authenticated;
create function public.list_follow_ups(p_view text default 'pending',p_my boolean default false,p_lead uuid default null,p_page integer default 1,p_counts_only boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=public.lead_organization();moment timestamptz:=statement_timestamp();day_start timestamptz;day_end timestamptz;counts jsonb;rows jsonb;total bigint;
begin
 if org is null then raise exception 'Operational staff required' using errcode='42501';end if;
 if p_view is null or p_view not in('pending','due_today','overdue','upcoming','all','completed','cancelled') or p_my is null or p_counts_only is null or p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid callback filters' using errcode='22023';end if;
 if p_lead is not null and not exists(select 1 from public.leads where organization_id=org and id=p_lead) then raise exception 'Lead unavailable' using errcode='42501';end if;
 day_start=date_trunc('day',moment at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';day_end=day_start+interval '1 day';
 with base as(select * from public.follow_ups f where f.organization_id=org and (p_lead is null or f.lead_id=p_lead) and (not p_my or f.assigned_to=auth.uid() or(f.assigned_to is null and f.created_by=auth.uid())))
 , totals as(select jsonb_build_object('pending',count(*) filter(where state='pending'),'due_today',count(*) filter(where state='pending' and due_at>=day_start and due_at<day_end),'overdue',count(*) filter(where state='pending' and due_at<moment),'upcoming',count(*) filter(where state='pending' and due_at>=day_end)) as value from base), selected as(
 select f.*,l.name lead_name,l.mobile_no,s.label lead_status,s.category lead_category,coalesce(creator.full_name,'Unavailable staff') creator_name,coalesce(assignee.full_name,'Unassigned') assigned_name,coalesce(m.active and m.role in('admin','manager','telecaller'),false) assigned_active
 from public.follow_ups f join public.leads l on l.id=f.lead_id and l.organization_id=f.organization_id join public.lead_statuses s on s.id=l.status_id and s.organization_id=l.organization_id
 left join public.staff_profiles creator on creator.id=f.created_by left join public.staff_profiles assignee on assignee.id=f.assigned_to left join public.organization_memberships m on m.user_id=f.assigned_to and m.organization_id=f.organization_id
 where f.organization_id=org and(p_lead is null or f.lead_id=p_lead) and(not p_my or f.assigned_to=auth.uid() or(f.assigned_to is null and f.created_by=auth.uid())) and
 (p_view='all' or p_view='pending' and f.state='pending' or p_view in('completed','cancelled') and f.state=p_view or p_view='due_today' and f.state='pending' and due_at>=day_start and due_at<day_end or p_view='overdue' and f.state='pending' and due_at<moment or p_view='upcoming' and f.state='pending' and due_at>=day_end)),
 paged as(select * from selected order by due_at,id limit 20 offset(p_page-1)*20)
 select (select value from totals),(select count(*) from selected),case when p_counts_only then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(p) order by p.due_at,p.id) from paged p),'[]'::jsonb) end into counts,total,rows;
 return jsonb_build_object('items',rows,'total',total,'page',p_page,'counts',counts,'server_now',moment,'day_start',day_start,'day_end',day_end);
end $$;
revoke all on function public.list_follow_ups(text,boolean,uuid,integer,boolean) from public,anon;grant execute on function public.list_follow_ups(text,boolean,uuid,integer,boolean) to authenticated;
create function public.follow_up_history(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=public.lead_organization();begin
 if org is null or not exists(select 1 from public.follow_ups where id=p_id and organization_id=org) then raise exception 'Callback unavailable' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'actor',coalesce(p.full_name,'Unavailable staff'),'time',h.occurred_at,'action',h.action,'before',h.before_data,'after',h.after_data) order by h.revision) from public.follow_up_history h left join public.staff_profiles p on p.id=h.actor_id where h.organization_id=org and h.follow_up_id=p_id),'[]'::jsonb);
end $$;
revoke all on function public.follow_up_history(uuid) from public,anon;grant execute on function public.follow_up_history(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
