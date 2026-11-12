begin;
-- Explicit JSON null validation; existing applied migrations remain immutable.
create or replace function public.save_workspace_setting(p_kind text,p_id uuid,p_revision integer,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=public.lead_organization();old_status public.lead_statuses;new_status public.lead_statuses;old_setting public.crm_workspace_settings;layout jsonb;keys text[]:=array['name','mobile','status','course','source','traffic','received','address','notes','actions'];entry record;next_category text;begin
 if org is null or not exists(select 1 from public.organization_memberships where user_id=auth.uid() and organization_id=org and active and role='admin')then raise exception 'Admin required' using errcode='42501';end if;
 perform 1 from public.organizations where id=org for update;
 if p_revision is null or p_revision<0 or p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'Invalid settings' using errcode='22023';end if;
 if p_kind='status' then
 if (select array_agg(k order by k) from jsonb_object_keys(p_input)k)<>array['active','category','color','label','sort_order'] or jsonb_typeof(p_input->'active')<>'boolean' or length(trim(p_input->>'label'))not between 1 and 80 or p_input->>'color'!~'^#[a-fA-F0-9]{6}$' or coalesce(p_input->>'category','')not in('new','other','confirmed','cancelled') or coalesce(p_input->>'sort_order','')!~'^-?[0-9]{1,6}$' then raise exception 'Invalid status settings' using errcode='22023';end if;
 next_category=p_input->>'category';
 if p_id is not null then
 select * into old_status from public.lead_statuses where id=p_id and organization_id=org for update;
 if not found then raise exception 'Unavailable status' using errcode='42501';end if;
 if old_status.revision<>p_revision then raise exception 'Status changed' using errcode='PT409';end if;
 if old_status.category in('new','confirmed') and (next_category<>old_status.category or not(p_input->>'active')::boolean)then raise exception 'New and Confirm must remain active with their category' using errcode='22023';end if;
 if next_category<>old_status.category and(exists(select 1 from public.leads where status_id=p_id)or exists(select 1 from public.call_attempts where previous_status_id=p_id or outcome_status_id=p_id)or exists(select 1 from public.lead_edit_history where organization_id=org and changes::text like '%'||p_id::text||'%'))then raise exception 'Used status categories cannot be remapped; create a new status' using errcode='22023';end if;
 update public.lead_statuses set label=trim(p_input->>'label'),active=(p_input->>'active')::boolean,category=next_category,color=p_input->>'color',sort_order=(p_input->>'sort_order')::integer,revision=revision+1 where id=p_id returning * into new_status;
 else
 if p_revision<>0 or next_category in('new','confirmed')then raise exception 'Choose other or cancelled for a new status; system categories already exist' using errcode='22023';end if;
 insert into public.lead_statuses(organization_id,label,active,category,color,sort_order)values(org,trim(p_input->>'label'),(p_input->>'active')::boolean,next_category,p_input->>'color',(p_input->>'sort_order')::integer)returning * into new_status;
 end if;
 insert into public.crm_settings_history(organization_id,actor_id,kind,before_value,after_value)values(org,auth.uid(),'status',case when p_id is null then null else to_jsonb(old_status)end,to_jsonb(new_status));return to_jsonb(new_status);
 elsif p_kind='columns' then
 layout=p_input;
 if (select array_agg(k order by k)from jsonb_object_keys(layout)k)<>array['hidden','order','widths'] or jsonb_typeof(layout->'order')<>'array' or jsonb_array_length(layout->'order')<>10 or (select count(distinct v)from jsonb_array_elements_text(layout->'order')v)<>10 or exists(select 1 from jsonb_array_elements_text(layout->'order')v where not(v=any(keys)))or layout->'order'->>0<>'name' or layout->'order'->>1<>'mobile' or layout->'order'->>9<>'actions' or jsonb_typeof(layout->'hidden')<>'array' or exists(select 1 from jsonb_array_elements_text(layout->'hidden')v where v is null or not(v=any(keys))or v in('name','mobile','actions'))or jsonb_typeof(layout->'widths')<>'object' then raise exception 'Invalid column layout' using errcode='22023';end if;
 for entry in select * from jsonb_each_text(layout->'widths')loop if entry.value is null or not(entry.key=any(keys))or entry.value!~'^[0-9]{3}$' or entry.value::integer not between 100 and 600 then raise exception 'Invalid width' using errcode='22023';end if;end loop;
 select * into old_setting from public.crm_workspace_settings where organization_id=org for update;
 if coalesce(old_setting.revision,0)<>p_revision then raise exception 'Defaults changed' using errcode='PT409';end if;
 insert into public.crm_workspace_settings(organization_id,columns,updated_by)values(org,layout,auth.uid())on conflict(organization_id)do update set columns=excluded.columns,revision=public.crm_workspace_settings.revision+1,updated_by=auth.uid(),updated_at=now();
 insert into public.crm_settings_history(organization_id,actor_id,kind,before_value,after_value)values(org,auth.uid(),'columns',old_setting.columns,layout);return(select to_jsonb(s)from public.crm_workspace_settings s where organization_id=org);
 end if;raise exception 'Unknown setting' using errcode='22023';
end$$;

create or replace function public.performance_report(d jsonb,p_kind text default 'summary',p_page integer default 1,p_actor text default '',p_staff_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid:=public.lead_organization();who uuid:=auth.uid();role_name text;start_day date;end_day date;lo timestamptz;hi timestamptz;moment timestamptz:=statement_timestamp();result jsonb;k text;v text;opts jsonb;
begin
 if org is null then raise exception 'Active operational access required' using errcode='42501';end if;
 select role into role_name from public.organization_memberships where organization_id=org and user_id=who and active;
 if role_name not in('admin','manager','telecaller') or role_name is null then raise exception 'Performance access denied' using errcode='42501';end if;
 if d is null or jsonb_typeof(d)<>'object' or exists(select 1 from jsonb_object_keys(d)x where x not in('from','to','brand','product','landing_page','source','status')) or jsonb_typeof(d->'from') is distinct from 'string' or jsonb_typeof(d->'to') is distinct from 'string' then raise exception 'Invalid report definition' using errcode='22023';end if;
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
 if d?'status' and jsonb_typeof(d->'status') is distinct from 'string' then raise exception 'Invalid status'using errcode='22023';end if;
 if coalesce(d->>'status','')<>'' and not exists(select 1 from public.lead_statuses where organization_id=org and id::text=d->>'status')then raise exception 'Unavailable status'using errcode='22023';end if;
 -- Reuse organization-scoped snapshot options, but never return auth identifiers.
 opts=public.lead_filter_options();opts=jsonb_build_object('brand',opts->'brands','product',opts->'products','landing_page',opts->'landing_pages','source',opts->'sources','status',(select coalesce(jsonb_agg(jsonb_build_object('value',id::text,'label',label)order by sort_order,label),'[]')from public.lead_statuses where organization_id=org),'caller',(select coalesce(jsonb_agg(x),'[]')from(select md5(org::text||m.user_id::text)value,p.full_name label from public.organization_memberships m join public.staff_profiles p on p.id=m.user_id where m.organization_id=org and m.role in('admin','manager','telecaller')and(role_name<>'telecaller'or m.user_id=who)order by p.full_name limit 500)x));
 with filtered as materialized (
 select l.*,i.source_timestamp from public.leads l left join public.lead_ingestion i on i.organization_id=l.organization_id and i.lead_id=l.id
 where l.organization_id=org and(coalesce(d->>'status','')='' or l.status_id::text=d->>'status')
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
 'leaderboard',coalesce((select jsonb_agg(x order by x.first_confirmations desc,x.attempts desc,x.name)from(select name,active,attempts,first_confirmations from people order by first_confirmations desc,attempts desc,name limit 10)x),'[]'),
 'status_distribution',case when role_name='telecaller' then '[]'::jsonb else(select coalesce(jsonb_agg(x order by x.label),'[]')from(select s.label,count(*)total from cohort l join public.lead_statuses s on s.id=l.status_id group by s.label)x)end,
 'hourly',case when role_name='telecaller' then '[]'::jsonb else(select jsonb_agg(x order by x.hour)from(select h as "hour",(select count(*)from cohort l where extract(hour from l.created_at at time zone 'Asia/Kolkata')=h)leads from generate_series(0,23)h)x)end,
 'reasons',coalesce((select jsonb_agg(x order by x.total desc,x.label)from(select coalesce(nullif(trim(a.reason),''),'Not supplied')label,count(*)total from visible v join public.call_attempts a on a.id=v.id and v.kind='calls' group by 1 order by 2 desc,1 limit 20)x),'[]'),
 'staff_total',(select count(*)from people),'staff_page',p_staff_page,
 'staff',coalesce((select jsonb_agg(to_jsonb(x)order by x.name,x.key)from(select md5(org::text||actor::text) key,name,active,attempts,distinct_called,first_confirmations,reconfirmations,scheduled,rescheduled,completed,cancelled,
 coalesce((select jsonb_agg(o)from(select outcome label,count(*) total from visible v where v.actor=p.actor and v.kind='calls' group by outcome order by outcome)o),'[]'::jsonb) outcomes
 from people p order by name,actor limit 20 offset(p_staff_page-1)*20)x),'[]'::jsonb),
 'activity_total',(select count(*)from breakdown),'page',p_page,
 'activity',coalesce((select jsonb_agg(to_jsonb(x)order by x.at desc,x.id desc)from(select * from breakdown order by at desc,id desc limit 25 offset(p_page-1)*25)x),'[]'::jsonb)) into result;
 return result;
end$$;

notify pgrst,'reload schema';commit;
