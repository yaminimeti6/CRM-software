begin;
-- Read-only aggregate RPC. Existing shared operational RLS is not broadened.
create index performance_calls_time on public.call_attempts(organization_id,attempted_at,caller_id,lead_id);
create index performance_events_time on public.confirmation_events(organization_id,confirmed_at,confirmed_by,lead_id);
create index performance_first_time on public.leads(organization_id,first_confirmed_at,first_confirmed_by);
create index performance_callback_history_time on public.follow_up_history(organization_id,occurred_at,actor_id);

create function public.performance_report(d jsonb,p_kind text default 'summary',p_page integer default 1,p_actor text default '',p_staff_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid:=public.lead_organization();who uuid:=auth.uid();role_name text;start_day date;end_day date;lo timestamptz;hi timestamptz;moment timestamptz:=statement_timestamp();result jsonb;k text;v text;opts jsonb;
begin
 if org is null then raise exception 'Active operational access required' using errcode='42501';end if;
 select role into role_name from public.organization_memberships where organization_id=org and user_id=who and active;
 if role_name not in('admin','manager','telecaller') or role_name is null then raise exception 'Performance access denied' using errcode='42501';end if;
 if d is null or jsonb_typeof(d)<>'object' or exists(select 1 from jsonb_object_keys(d)x where x not in('from','to','brand','product','landing_page','source')) or jsonb_typeof(d->'from') is distinct from 'string' or jsonb_typeof(d->'to') is distinct from 'string' then raise exception 'Invalid report definition' using errcode='22023';end if;
 if d->>'from' !~ '^\d{4}-\d{2}-\d{2}$' or d->>'to' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Use ISO dates' using errcode='22023';end if;
 start_day=(d->>'from')::date;end_day=(d->>'to')::date;
 if start_day<'2000-01-01' or end_day>'2100-12-31' or end_day<start_day or end_day-start_day>365 then raise exception 'Choose 1 to 366 inclusive days' using errcode='22023';end if;
 lo=start_day::timestamp at time zone 'Asia/Kolkata';hi=(end_day+1)::timestamp at time zone 'Asia/Kolkata';
 if p_kind is null or p_kind not in('summary','calls','distinct_calls','confirmations','first_confirmations','reconfirmations','callbacks','completed','pending','overdue','leads','current') or p_page is null or p_page<1 or p_page>100000 or p_staff_page is null or p_staff_page<1 or p_staff_page>100000 or p_actor is null or length(p_actor)>32 then raise exception 'Invalid report page or kind' using errcode='22023';end if;
 if p_actor<>'' and p_kind in('leads','current','pending','overdue') then raise exception 'This state/cohort breakdown has no activity actor' using errcode='22023';end if;
 if role_name='telecaller' and (p_kind in('leads','current') or (p_actor<>'' and p_actor<>md5(org::text||who::text))) then raise exception 'Self performance only' using errcode='42501';end if;
 foreach k in array array['brand','product','landing_page','source'] loop
  if d?k and jsonb_typeof(d->k) is distinct from 'string' then raise exception 'Invalid attribution filter' using errcode='22023';end if;
  v=coalesce(d->>k,'');
  if v not in('','unknown') and v !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'Use stable attribution IDs' using errcode='22023';end if;
 end loop;
 -- Reuse organization-scoped snapshot options, but never return auth identifiers.
 opts=public.lead_filter_options();opts=jsonb_build_object('brand',opts->'brands','product',opts->'products','landing_page',opts->'landing_pages','source',opts->'sources');
 with filtered as materialized (
 select l.*,i.source_timestamp from public.leads l left join public.lead_ingestion i on i.organization_id=l.organization_id and i.lead_id=l.id
 where l.organization_id=org
 and(coalesce(d->>'brand','')='' or coalesce(i.source_snapshot->'configured_attribution'->'brand'->>'id','unknown')=d->>'brand')
 and(coalesce(d->>'product','')='' or coalesce(i.source_snapshot->'configured_attribution'->'product'->>'id','unknown')=d->>'product')
 and(coalesce(d->>'landing_page','')='' or coalesce(i.source_snapshot->'configured_attribution'->'landing_page'->>'id','unknown')=d->>'landing_page')
 and(coalesce(d->>'source','')='' or coalesce(i.source_id::text,'unknown')=d->>'source')
 ), all_confirmations as materialized (
 select e.*,row_number()over(partition by e.lead_id order by e.lead_version,e.id)=1 is_first from public.confirmation_events e join filtered l on l.id=e.lead_id where e.organization_id=org
 ), activity as materialized (
 select 'calls'::text kind,a.id,a.lead_id,a.caller_id actor,a.attempted_at at,a.outcome_label outcome,false is_first from public.call_attempts a join filtered l on l.id=a.lead_id where a.organization_id=org and a.attempted_at>=lo and a.attempted_at<hi
 union all select 'confirmations',e.id,e.lead_id,e.confirmed_by,e.confirmed_at,case when e.is_first then 'First confirmation' else 'Reconfirmation' end,e.is_first from all_confirmations e where e.confirmed_at>=lo and e.confirmed_at<hi
 union all select 'callbacks',h.id,f.lead_id,h.actor_id,h.occurred_at,h.action,false from public.follow_up_history h join public.follow_ups f on f.id=h.follow_up_id and f.organization_id=org join filtered l on l.id=f.lead_id where h.organization_id=org and h.occurred_at>=lo and h.occurred_at<hi
 ), visible as materialized (
 select a.* from activity a where (role_name<>'telecaller' or a.actor=who) and(p_actor='' or md5(org::text||a.actor::text)=p_actor)
 ), cohort as materialized(select * from filtered where created_at>=lo and created_at<hi),
 pending as materialized (
 select f.* from public.follow_ups f join filtered l on l.id=f.lead_id where f.organization_id=org and f.state='pending' and (role_name<>'telecaller' or f.assigned_to=who or(f.assigned_to is null and f.created_by=who))
 ), people as materialized (
 select a.actor,coalesce(p.full_name,'Former staff member') name,coalesce(m.active,false) active,
 count(*)filter(where a.kind='calls') attempts,count(distinct a.lead_id)filter(where a.kind='calls') distinct_called,
 count(*)filter(where a.kind='confirmations' and a.is_first) first_confirmations,count(*)filter(where a.kind='confirmations' and not a.is_first) reconfirmations,
 count(*)filter(where a.kind='callbacks' and a.outcome='scheduled') scheduled,count(*)filter(where a.kind='callbacks' and a.outcome='rescheduled') rescheduled,
 count(*)filter(where a.kind='callbacks' and a.outcome='completed') completed,count(*)filter(where a.kind='callbacks' and a.outcome='cancelled') cancelled
 from visible a left join public.staff_profiles p on p.id=a.actor left join public.organization_memberships m on m.user_id=a.actor and m.organization_id=org group by a.actor,p.full_name,m.active
 ), breakdown as materialized (
 select a.kind,a.id,a.lead_id,l.name lead_name,a.at,a.outcome,coalesce(p.full_name,'Former staff member') caller,l.created_at crm_received_at,l.source_timestamp historical_source_time
 from visible a join filtered l on l.id=a.lead_id left join public.staff_profiles p on p.id=a.actor where a.kind=p_kind
 or(p_kind='first_confirmations' and a.kind='confirmations' and a.is_first)
 or(p_kind='reconfirmations' and a.kind='confirmations' and not a.is_first)
 or(p_kind='completed' and a.kind='callbacks' and a.outcome='completed')
 union all select 'distinct_calls',x.id,x.lead_id,l.name,x.at,x.outcome,p.full_name,l.created_at,l.source_timestamp from(select distinct on(a.lead_id)a.* from visible a where a.kind='calls' and p_kind='distinct_calls' order by a.lead_id,a.at desc,a.id desc)x join filtered l on l.id=x.lead_id left join public.staff_profiles p on p.id=x.actor
 union all select p_kind,f.id,f.lead_id,l.name,f.due_at,'Pending callback (due time; assignment is not call credit)',null,l.created_at,l.source_timestamp from pending f join filtered l on l.id=f.lead_id where p_kind='pending' or(p_kind='overdue' and f.due_at<moment)
 union all select 'leads',l.id,l.id,l.name,l.created_at,'CRM received',null,l.created_at,l.source_timestamp from cohort l where p_kind='leads' and role_name<>'telecaller'
 union all select 'current',l.id,l.id,l.name,l.updated_at,'Currently confirmed',null,l.created_at,l.source_timestamp from filtered l join public.lead_statuses s on s.organization_id=org and s.id=l.status_id where p_kind='current' and s.category='confirmed' and role_name<>'telecaller'
 )
 select jsonb_build_object('refreshed_at',moment,'from',start_day,'to',end_day,'scope',case when role_name='telecaller' then 'self' else 'organization' end,'options',opts,
 'metrics',jsonb_build_object(
 'received',case when role_name='telecaller' then null else(select count(*)from cohort)end,
 'attempts',(select count(*)from visible where kind='calls'),'distinct_called',(select count(distinct lead_id)from visible where kind='calls'),
 'first_confirmed',(select count(*)from visible where kind='confirmations' and is_first),'confirmation_events',(select count(*)from visible where kind='confirmations'),
 'reconfirmations',(select count(*)from visible where kind='confirmations' and not is_first),
 'current_confirmed',case when role_name='telecaller' then null else(select count(*)from filtered l join public.lead_statuses s on s.id=l.status_id and s.organization_id=org where s.category='confirmed')end,
 'cohort_confirmed',case when role_name='telecaller' then null else(select count(*)from cohort l where exists(select 1 from all_confirmations e where e.lead_id=l.id and e.is_first))end,
 'cohort_conversion',case when role_name='telecaller' or(select count(*)from cohort)=0 then null else round(100.0*(select count(*)from cohort l where exists(select 1 from all_confirmations e where e.lead_id=l.id and e.is_first))/(select count(*)from cohort),2)end,
 'pending',(select count(*)from pending),'overdue',(select count(*)from pending where due_at<moment),
 'completed',(select count(*)from visible where kind='callbacks' and outcome='completed')),
 'outcomes',coalesce((select jsonb_agg(x order by x.label)from(select outcome label,count(*) total from visible where kind='calls' group by outcome)x),'[]'::jsonb),
 'daily',coalesce((select jsonb_agg(x order by x.day)from(select dt::date as day,
 case when role_name='telecaller' then null else(select count(*)from cohort l where (l.created_at at time zone 'Asia/Kolkata')::date=dt::date)end leads,
 (select count(*)from visible a where a.kind='calls' and(a.at at time zone 'Asia/Kolkata')::date=dt::date) calls,
 (select count(*)from visible a where a.kind='confirmations' and(a.at at time zone 'Asia/Kolkata')::date=dt::date) confirmations,
 (select count(*)from visible a where a.kind='confirmations' and a.is_first and(a.at at time zone 'Asia/Kolkata')::date=dt::date) first_confirmations
 from generate_series(start_day::timestamp,end_day::timestamp,'1 day'::interval)dt)x),'[]'::jsonb),
 'staff_total',(select count(*)from people),'staff_page',p_staff_page,
 'staff',coalesce((select jsonb_agg(to_jsonb(x)order by x.name,x.key)from(select md5(org::text||actor::text) key,name,active,attempts,distinct_called,first_confirmations,reconfirmations,scheduled,rescheduled,completed,cancelled,
 coalesce((select jsonb_agg(o)from(select outcome label,count(*) total from visible v where v.actor=p.actor and v.kind='calls' group by outcome order by outcome)o),'[]'::jsonb) outcomes
 from people p order by name,actor limit 20 offset(p_staff_page-1)*20)x),'[]'::jsonb),
 'activity_total',(select count(*)from breakdown),'page',p_page,
 'activity',coalesce((select jsonb_agg(to_jsonb(x)order by x.at desc,x.id desc)from(select * from breakdown order by at desc,id desc limit 25 offset(p_page-1)*25)x),'[]'::jsonb)) into result;
 return result;
end$$;
revoke all on function public.performance_report(jsonb,text,integer,text,integer) from public,anon,service_role;
grant execute on function public.performance_report(jsonb,text,integer,text,integer) to authenticated;
commit;
