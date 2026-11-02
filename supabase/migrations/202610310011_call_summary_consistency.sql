begin;
-- Keep version, current status, attribution and counts on one locked lead snapshot.
create or replace function public.lead_call_details(p_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare org uuid;lead public.leads;current_category text;
begin
 org=public.lead_organization();
 if org is null then raise exception 'Operational staff required' using errcode='42501';end if;
 if p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid page' using errcode='22023';end if;
 select * into lead from public.leads where id=p_id and organization_id=org for share;
 if not found then raise exception 'Lead unavailable' using errcode='42501';end if;
 select category into current_category from public.lead_statuses where id=lead.status_id and organization_id=org;
 return jsonb_build_object('version',lead.version,'status_id',lead.status_id,
  'attempt_count',(select count(*) from public.call_attempts where lead_id=p_id and organization_id=org),
  'confirmation_event_count',(select count(*) from public.confirmation_events where lead_id=p_id and organization_id=org),
  'distinct_confirmed_leads',case when lead.first_confirmed_at is null then 0 else 1 end,'currently_confirmed',current_category='confirmed',
  'first_confirmed_at',lead.first_confirmed_at,'latest_confirmed_at',lead.latest_confirmed_at,
  'first_confirmed_by',coalesce((select p.full_name from public.staff_profiles p join public.organization_memberships m on m.user_id=p.id where p.id=lead.first_confirmed_by and m.organization_id=org),'Unavailable staff member'),
  'latest_confirmed_by',coalesce((select p.full_name from public.staff_profiles p join public.organization_memberships m on m.user_id=p.id where p.id=lead.latest_confirmed_by and m.organization_id=org),'Unavailable staff member'),
  'calls',coalesce((select jsonb_agg(to_jsonb(c)) from (select a.id,a.attempted_at,a.outcome_label,a.reason,a.notes,coalesce(p.full_name,'Unavailable staff member') caller
    from public.call_attempts a left join public.organization_memberships m on m.user_id=a.caller_id and m.organization_id=org left join public.staff_profiles p on p.id=m.user_id
    where a.lead_id=p_id and a.organization_id=org order by a.attempted_at desc,a.id desc limit 20 offset (p_page-1)*20)c),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e)) from (select c.confirmed_at,c.source,coalesce(p.full_name,'Unavailable staff member') caller
    from public.confirmation_events c left join public.organization_memberships m on m.user_id=c.confirmed_by and m.organization_id=org left join public.staff_profiles p on p.id=m.user_id
    where c.lead_id=p_id and c.organization_id=org order by c.confirmed_at desc,c.id desc limit 20 offset (p_page-1)*20)e),'[]'::jsonb));
end $$;
commit;
