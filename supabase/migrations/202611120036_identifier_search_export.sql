begin;
create or replace function public.advanced_lead_search(d jsonb,p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path='' as $$declare org uuid:=public.lead_organization();result jsonb;sort text;dir text;sql text;predicates jsonb;begin
 d=jsonb_build_object('websites','[]'::jsonb,'traffic_sources','[]'::jsonb)||d;
 perform crm_private.validate_lead_view(d,org);if p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid page' using errcode='22023';end if;
 select coalesce(jsonb_agg(p||jsonb_build_object('key',f.field_key,'source',f.source_id,'version',f.form_version)),'[]')into predicates from jsonb_array_elements(d->'quiz')p join public.quiz_columns()f on f.id=p->>'field';
 sort=case d->>'sort' when 'name' then 'lower(l.name)' when 'updated_at' then 'l.updated_at' else 'l.created_at' end;dir=case when d->>'direction'='asc' then 'asc' else 'desc' end;
 sql=$query$with filtered as materialized(select l.*,crm_private.submitted_order(i) order_details,i.source_id,i.source_snapshot,i.is_repeat,i.lead_id is not null public_inquiry,p.historical_confirmed,p.source_at from public.leads l left join public.lead_ingestion i on i.lead_id=l.id left join public.lead_import_provenance p on p.lead_id=l.id where l.organization_id=$1
 and(jsonb_array_length($2->'websites')=0 or $2->'websites'?(crm_private.submitted_order(i)->>'website'))
 and(jsonb_array_length($2->'traffic_sources')=0 or $2->'traffic_sources'?(crm_private.submitted_order(i)->>'traffic_source'))
 and(($2->>'q')='' or strpos(lower(l.name),lower($2->>'q'))>0 or strpos(l.mobile_no,$2->>'q')>0 or strpos(lower(l.id::text),lower($2->>'q'))>0
 or strpos(lower(coalesce(i.submission_id::text,'')),lower($2->>'q'))>0
 or strpos(lower(coalesce(crm_private.submitted_order(i)->>'order_id','')),lower($2->>'q'))>0
 or exists(select 1 from jsonb_each_text(coalesce(i.raw_advertising,'{}'::jsonb)||coalesce(crm_private.submitted_order(i)->'answers','{}'::jsonb))kv where kv.key in('creative_id','AdCrevId','ad_id')and strpos(lower(kv.value),lower($2->>'q'))>0))
 and(jsonb_array_length($2->'statuses')=0 or $2->'statuses'?l.status_id::text)
 and(($2->>'created_from')='' or l.created_at>=((nullif($2->>'created_from',''))::date::timestamp at time zone 'Asia/Kolkata'))
 and(($2->>'created_to')='' or l.created_at<(((nullif($2->>'created_to',''))::date+1)::timestamp at time zone 'Asia/Kolkata'))
 and(($2->>'updated_from')='' or l.updated_at>=((nullif($2->>'updated_from',''))::date::timestamp at time zone 'Asia/Kolkata'))
 and(($2->>'updated_to')='' or l.updated_at<(((nullif($2->>'updated_to',''))::date+1)::timestamp at time zone 'Asia/Kolkata'))
 and(jsonb_array_length($2->'brands')=0 or $2->'brands'?coalesce(i.source_snapshot->'configured_attribution'->'brand'->>'id','unknown'))
 and(jsonb_array_length($2->'products')=0 or $2->'products'?coalesce(i.source_snapshot->'configured_attribution'->'product'->>'id','unknown'))
 and(jsonb_array_length($2->'landing_pages')=0 or $2->'landing_pages'?coalesce(i.source_snapshot->'configured_attribution'->'landing_page'->>'id','unknown'))
 and(jsonb_array_length($2->'sources')=0 or $2->'sources'?coalesce(i.source_id::text,'unknown'))
 and(jsonb_array_length($2->'versions')=0 or i.source_id is null and $2->'versions'?'unknown' or exists(select 1 from jsonb_array_elements_text($2->'versions')v where v<>'unknown' and v::jsonb=jsonb_build_array(i.source_id::text,coalesce(i.source_snapshot->>'form_version',''))))
 and(jsonb_array_length($2->'callers')=0 or exists(select 1 from public.call_attempts a where a.lead_id=l.id and $2->'callers'?a.caller_id::text))
 and(jsonb_array_length($2->'confirmers')=0 or exists(select 1 from public.confirmation_events e where e.lead_id=l.id and $2->'confirmers'?e.confirmed_by::text))
 and(($2->>'callbacks')='any' or($2->>'callbacks')='none' and not exists(select 1 from public.follow_ups f where f.lead_id=l.id and f.state='pending')or($2->>'callbacks')in('pending','overdue')and exists(select 1 from public.follow_ups f where f.lead_id=l.id and f.state='pending' and(($2->>'callbacks')='pending' or f.due_at<now())))
 and(($2->>'repeat')='any' or($2->>'repeat')='unknown' and i.lead_id is null or($2->>'repeat')='repeat' and i.is_repeat or($2->>'repeat')='first' and not i.is_repeat)
 and not exists(select 1 from jsonb_array_elements($4)f where not crm_private.quiz_predicate(l.answers,i.source_id,coalesce(i.source_snapshot->>'form_version',''),f,$1)))
 select jsonb_build_object('total',(select count(*)from filtered),'leads',coalesce((select jsonb_agg(to_jsonb(page)order by SORT_EXPR DIR,id DIR)from(select filtered.*,source_snapshot->'configured_attribution' configured_attribution,case when source_id is null then null else jsonb_build_object('source_id',source_id,'form_version',coalesce(source_snapshot->>'form_version',''))end quiz_scope,case when historical_confirmed is null then null else jsonb_build_object('historical_confirmed',historical_confirmed,'source_at',source_at)end historical_import from filtered order by SORT_EXPR DIR,id DIR limit ($2->>'size')::integer offset ($3-1)*($2->>'size')::integer)page),'[]'))$query$;
 -- Only these hard-coded expressions enter SQL. All user values remain parameters.
 sql=replace(replace(sql,'SORT_EXPR',replace(sort,'l.','')),'DIR',dir);execute sql into result using org,d,p_page,predicates;
 return result||jsonb_build_object('fields',(select coalesce(jsonb_agg(to_jsonb(f)),'[]')from public.quiz_columns()f),'statuses',(select coalesce(jsonb_agg(to_jsonb(s)order by sort_order,label),'[]')from public.lead_statuses s where organization_id=org));
end$$;


create function crm_private.collect_filtered_export(d jsonb)returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid:=public.lead_organization();result jsonb;part jsonb;rows jsonb:='[]';n integer;pages integer;begin
 if org is null or not exists(select 1 from public.organization_memberships where user_id=auth.uid()and organization_id=org and active and role='admin')then raise exception 'Admin export required'using errcode='42501';end if;
 -- One repeatable SQL statement collects the whole filtered result, never just the displayed page.
 d=jsonb_set(d,'{size}','50');part=public.advanced_lead_search(d,1);n=(part->>'total')::integer;
 if n>5000 then raise exception 'Narrow filters to at most 5000 leads before export'using errcode='22023';end if;
 rows=part->'leads';pages=ceil(n/50.0)::integer;
 for i in 2..pages loop rows=rows||(public.advanced_lead_search(d,i)->'leads');if octet_length(rows::text)>8000000 then raise exception 'Narrow filters; export exceeds 8 MB'using errcode='22023';end if;end loop;
 if octet_length(rows::text)>8000000 then raise exception 'Narrow filters; export exceeds 8 MB'using errcode='22023';end if;
 return jsonb_build_object('leads',rows,'statuses',part->'statuses','total',n);
end$$;
revoke all on function crm_private.collect_filtered_export(jsonb)from public,anon,authenticated;
create function public.export_filtered_leads(d jsonb)returns jsonb language plpgsql volatile security definer set search_path='' as $$declare org uuid:=public.lead_organization();result jsonb;begin
 if org is null or not exists(select 1 from public.organization_memberships where user_id=auth.uid()and organization_id=org and active and role='admin')then raise exception 'Admin export required'using errcode='42501';end if;
 result=crm_private.collect_filtered_export(d);
 insert into public.crm_settings_history(organization_id,actor_id,kind,after_value)values(org,auth.uid(),'lead_export',jsonb_build_object('count',result->'total','filters',d));return result;
end$$;
revoke all on function public.export_filtered_leads(jsonb)from public,anon;grant execute on function public.export_filtered_leads(jsonb)to authenticated;
notify pgrst,'reload schema';commit;
