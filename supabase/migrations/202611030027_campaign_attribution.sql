begin;
-- Campaigns extend the existing reference catalog. Legacy campaign_id remains raw metadata.
alter table public.ad_references drop constraint ad_references_kind_check;
alter table public.ad_references add constraint ad_references_kind_check check(kind in('creative','ad','campaign'));
alter table public.ad_references add column campaign_ref uuid;
alter table public.ad_references add foreign key(organization_id,campaign_ref)references public.ad_references(organization_id,id);
alter table public.ad_references add constraint ad_campaign_parent_kind check(campaign_ref is null or kind='ad');
alter table public.ad_mapping_rules drop constraint ad_mapping_rules_reported_kind_check;
alter table public.ad_mapping_rules add constraint ad_mapping_rules_reported_kind_check check(reported_kind in('creative','ad','campaign'));
create function crm_private.check_ad_campaign_parent()returns trigger language plpgsql security definer set search_path=''as $$begin
 if NEW.campaign_ref is not null and not exists(select 1 from public.ad_references p where p.organization_id=NEW.organization_id and p.id=NEW.campaign_ref and p.kind='campaign')then raise exception 'Campaign parent must be a same-organization campaign'using errcode='23514';end if;return NEW;end$$;
revoke all on function crm_private.check_ad_campaign_parent()from public,anon,authenticated,service_role;
create trigger ad_campaign_parent before insert or update on public.ad_references for each row execute function crm_private.check_ad_campaign_parent();
create or replace function public.save_ad_attribution(p_module text,p_id uuid,p_revision integer,p_input jsonb)returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid:=crm_private.import_admin();r public.ad_references;m public.ad_mapping_rules;old_data jsonb;new_data jsonb;parent uuid;campaign uuid;
begin
 if p_id is null or p_revision is null or p_revision<0 or p_module is null or p_module not in('reference','mapping') or p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'Invalid attribution input' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('ad-attribution:'||org::text,0));
 if p_module='reference' then
  if (p_input?'external_id' and jsonb_typeof(p_input->'external_id')<>'string')or(p_input?'campaign_id' and jsonb_typeof(p_input->'campaign_id')<>'string')or(p_input?'creative_id' and jsonb_typeof(p_input->'creative_id')not in('string','null'))or exists(select 1 from jsonb_object_keys(p_input)k where k not in('kind','name','external_id','campaign_id','creative_id','campaign_ref','archived')) or jsonb_typeof(p_input->'name')is distinct from 'string' or jsonb_typeof(p_input->'archived')is distinct from 'boolean' or coalesce(p_input->>'kind','')not in('creative','ad','campaign') or length(trim(p_input->>'name'))not between 1 and 100
   or coalesce(p_input->>'external_id','')!~ '^[a-zA-Z0-9_.:-]{0,100}$' or coalesce(p_input->>'campaign_id','')!~ '^[a-zA-Z0-9_.:-]{0,100}$' then raise exception 'Invalid reference fields' using errcode='22023';end if;
  parent=nullif(p_input->>'creative_id','')::uuid;campaign=nullif(p_input->>'campaign_ref','')::uuid;
 if campaign is not null and(p_input->>'kind'<>'ad' or not exists(select 1 from public.ad_references where id=campaign and organization_id=org and kind='campaign' and(not archived or(p_input->>'archived')::boolean)))then raise exception 'Campaign relationship unavailable'using errcode='42501';end if;
  if parent is not null and(p_input->>'kind'<>'ad' or not exists(select 1 from public.ad_references where id=parent and organization_id=org and kind='creative' and(archived=false or(p_input->>'archived')::boolean)))then raise exception 'Creative relationship unavailable' using errcode='42501';end if;
  select * into r from public.ad_references where id=p_id and organization_id=org for update;
  if p_revision=0 then
   if found then raise exception 'Reference already exists; reload' using errcode='PT409';end if;
   insert into public.ad_references(id,organization_id,kind,name,external_id,campaign_id,creative_id,campaign_ref,archived,created_by)values(p_id,org,p_input->>'kind',trim(p_input->>'name'),coalesce(p_input->>'external_id',''),coalesce(p_input->>'campaign_id',''),parent,campaign,(p_input->>'archived')::boolean,auth.uid())returning to_jsonb(ad_references.*)into new_data;
  else
   if not found or r.revision<>p_revision then raise exception 'Reference changed' using errcode='PT409';end if;
   if r.kind<>p_input->>'kind' or r.creative_id is distinct from parent or r.campaign_ref is distinct from campaign or r.external_id<>coalesce(p_input->>'external_id','') or r.campaign_id<>coalesce(p_input->>'campaign_id','')then raise exception 'Identity/relationships immutable; archive and create a new reference' using errcode='22023';end if;
   old_data=to_jsonb(r);update public.ad_references set name=trim(p_input->>'name'),archived=(p_input->>'archived')::boolean,revision=revision+1 where id=p_id returning to_jsonb(ad_references.*)into new_data;
  end if;
 else
  if jsonb_typeof(p_input->'form_version')is distinct from 'string'or jsonb_typeof(p_input->'reported_value')is distinct from 'string'or exists(select 1 from jsonb_object_keys(p_input)k where k not in('source_id','form_version','reported_kind','reported_value','reference_id','active','review_acknowledged'))or p_input->'review_acknowledged' is distinct from 'true'::jsonb or jsonb_typeof(p_input->'active')is distinct from 'boolean' or coalesce(p_input->>'reported_kind','')not in('creative','ad','campaign') or coalesce(p_input->>'reported_value','')!~ '^[a-zA-Z0-9_.:-]{1,100}$' then raise exception 'Choose a creative/ad reported ID, never a click ID' using errcode='22023';end if;
  if not exists(select 1 from public.source_form_versions where organization_id=org and source_id=(p_input->>'source_id')::uuid and version_key=p_input->>'form_version')or not exists(select 1 from public.ad_references target_ref where target_ref.organization_id=org and target_ref.id=(p_input->>'reference_id')::uuid and target_ref.kind=p_input->>'reported_kind' and (not(p_input->>'active')::boolean or(not target_ref.archived and(target_ref.creative_id is null or exists(select 1 from public.ad_references c where c.organization_id=org and c.id=target_ref.creative_id and not c.archived))and(target_ref.campaign_ref is null or exists(select 1 from public.ad_references cp where cp.organization_id=org and cp.id=target_ref.campaign_ref and not cp.archived)))))then raise exception 'Source/version/reference unavailable' using errcode='42501';end if;
  select * into m from public.ad_mapping_rules where id=p_id and organization_id=org for update;
  if p_revision=0 then
   if found then raise exception 'Mapping already exists; reload' using errcode='PT409';end if;
   insert into public.ad_mapping_rules(id,organization_id,source_id,form_version,reported_kind,reported_value,reference_id,active,reviewed_by)values(p_id,org,(p_input->>'source_id')::uuid,p_input->>'form_version',p_input->>'reported_kind',p_input->>'reported_value',(p_input->>'reference_id')::uuid,(p_input->>'active')::boolean,auth.uid())returning to_jsonb(ad_mapping_rules.*)into new_data;
  else
   if not found or m.revision<>p_revision then raise exception 'Mapping changed' using errcode='PT409';end if;
   if m.source_id<>(p_input->>'source_id')::uuid or m.form_version<>p_input->>'form_version' or m.reported_kind<>p_input->>'reported_kind' or m.reported_value<>p_input->>'reported_value'then raise exception 'Mapping key/scope immutable; disable and create a new rule' using errcode='22023';end if;
   old_data=to_jsonb(m);update public.ad_mapping_rules set reference_id=(p_input->>'reference_id')::uuid,active=(p_input->>'active')::boolean,revision=revision+1,reviewed_by=auth.uid(),reviewed_at=clock_timestamp() where id=p_id returning to_jsonb(ad_mapping_rules.*)into new_data;
  end if;
 end if;
 insert into crm_private.ad_mapping_audit(organization_id,module,record_id,actor_id,before_data,after_data)values(org,p_module,p_id,auth.uid(),old_data,new_data);
 return p_id;
end$$;
create or replace function public.ad_attribution_admin(p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid;begin
 select organization_id into org from public.organization_memberships where user_id=auth.uid()and active and role='admin';
 if org is null then raise exception 'Active Admin required' using errcode='42501';end if;
 if p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid page' using errcode='22023';end if;
 return jsonb_build_object('references',coalesce((select jsonb_agg(x)from(select id,kind,name,external_id,campaign_id,creative_id,campaign_ref,archived,revision from public.ad_references where organization_id=org order by created_at desc,id limit 20 offset(p_page-1)*20)x),'[]'::jsonb),
 'reference_total',(select count(*)from public.ad_references where organization_id=org),
 'mappings',coalesce((select jsonb_agg(x)from(select m.id,m.source_id,m.form_version,m.reported_kind,m.reported_value,m.reference_id,m.active,m.revision,m.reviewed_at,p.full_name reviewed_by from public.ad_mapping_rules m left join public.staff_profiles p on p.id=m.reviewed_by where m.organization_id=org order by m.reviewed_at desc,m.id limit 20 offset(p_page-1)*20)x),'[]'::jsonb),
 'mapping_total',(select count(*)from public.ad_mapping_rules where organization_id=org),
 'versions',coalesce((select jsonb_agg(x)from(select v.source_id,v.version_key,s.name source_name from public.source_form_versions v join public.ingestion_sources s on s.id=v.source_id and s.organization_id=org where v.organization_id=org order by s.name,v.version_key limit 500)x),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(x)from(select a.module,a.record_id,a.occurred_at,p.full_name actor,a.before_data,a.after_data from crm_private.ad_mapping_audit a left join public.staff_profiles p on p.id=a.actor_id where a.organization_id=org order by a.occurred_at desc,a.id limit 20 offset(p_page-1)*20)x),'[]'::jsonb),'audit_total',(select count(*)from crm_private.ad_mapping_audit where organization_id=org));
end$$;
create or replace function crm_private.capture_ad_attribution()returns trigger language plpgsql security definer set search_path='' as $$
declare raw jsonb;has_reported boolean;invalid boolean:=false;kind_name text;candidate jsonb;value_text text;snap jsonb:='{}';rule public.ad_mapping_rules;r public.ad_references;c public.ad_references;obj jsonb;begin
 raw=crm_private.ad_reported_inputs(NEW);has_reported=exists(select 1 from jsonb_each(raw)x where x.value<>'null'::jsonb and x.value<>'""'::jsonb);
 if raw?'AdCrevId' and raw?'creative_id' and raw->'AdCrevId' is distinct from raw->'creative_id'then invalid=true;end if;
 if raw?'campId'and raw?'campaign_id'and raw->'campId'is distinct from raw->'campaign_id'then invalid=true;end if;
 foreach kind_name in array array['creative','ad','campaign']loop
 candidate=case when kind_name='creative'then coalesce(raw->'AdCrevId',raw->'creative_id')when kind_name='campaign'then coalesce(raw->'campId',raw->'campaign_id')else raw->'ad_id'end;
 if candidate is not null and candidate not in('null'::jsonb,'""'::jsonb)then
 if jsonb_typeof(candidate)<>'string' or candidate#>>'{}'!~'^[a-zA-Z0-9_.:-]{1,100}$' then invalid=true;else
 value_text=candidate#>>'{}';select * into rule from public.ad_mapping_rules where organization_id=NEW.organization_id and source_id=NEW.source_id and form_version=coalesce(NEW.source_snapshot->>'form_version','')and reported_kind=kind_name and reported_value=value_text and active;
 if found then select * into r from public.ad_references where id=rule.reference_id and organization_id=NEW.organization_id and kind=kind_name and not archived;
 if found then
 obj=jsonb_build_object('id',r.id,'name',r.name,'provenance','reviewed_mapping','rule_id',rule.id,'rule_revision',rule.revision,'reviewed_by',rule.reviewed_by,'reviewed_at',rule.reviewed_at);
 if kind_name='ad' and r.creative_id is not null then select * into c from public.ad_references where organization_id=NEW.organization_id and id=r.creative_id and kind='creative' and not archived;
 if found then obj=obj||jsonb_build_object('creative',jsonb_build_object('id',c.id,'name',c.name));else obj=null;end if;end if;
 if kind_name='ad'and r.campaign_ref is not null then select * into c from public.ad_references where organization_id=NEW.organization_id and id=r.campaign_ref and kind='campaign'and not archived;
 if found and obj is not null then obj=obj||jsonb_build_object('campaign',jsonb_build_object('id',c.id,'name',c.name));else obj=null;end if;end if;
 if obj is not null then snap=snap||jsonb_build_object(kind_name,obj);end if;
 end if;end if;
 end if;end if;
 end loop;
 if snap?'ad' and snap->'ad'?'creative'then
  if snap?'creative' and snap->'creative'->>'id'<>snap->'ad'->'creative'->>'id'then invalid=true;
  elsif not(snap?'creative')then snap=snap||jsonb_build_object('creative',(snap->'ad'->'creative')||jsonb_build_object('provenance','reviewed_ad_relationship','rule_id',snap->'ad'->'rule_id','rule_revision',snap->'ad'->'rule_revision','reviewed_by',snap->'ad'->'reviewed_by','reviewed_at',snap->'ad'->'reviewed_at'));end if;
 end if;
 if snap?'ad'and snap->'ad'?'campaign'then
 if snap?'campaign'and snap->'campaign'->>'id'<>snap->'ad'->'campaign'->>'id'then invalid=true;
 elsif not(snap?'campaign')then snap=snap||jsonb_build_object('campaign',(snap->'ad'->'campaign')||jsonb_build_object('provenance','reviewed_ad_relationship','rule_id',snap->'ad'->'rule_id','rule_revision',snap->'ad'->'rule_revision','reviewed_by',snap->'ad'->'reviewed_by','reviewed_at',snap->'ad'->'reviewed_at'));end if;end if;
 if invalid then snap='{}';end if;
 snap=snap||jsonb_build_object('coverage',case when snap?'creative' or snap?'ad'or snap?'campaign'then 'mapped' when has_reported then 'reported_unverified' else 'unknown'end,'invalid_or_conflicting',invalid,'independently_verified',false);
 insert into crm_private.ad_attribution_snapshots(lead_id,organization_id,source_id,form_version,snapshot)values(NEW.lead_id,NEW.organization_id,NEW.source_id,coalesce(NEW.source_snapshot->>'form_version',''),snap);
 return NEW;
end$$;
create or replace function public.ad_cohort_report(d jsonb,p_dimension text default 'creative',p_sort text default 'volume',p_page integer default 1)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare org uuid:=crm_private.ad_report_org();analyst boolean;lo timestamptz;hi timestamptz;a date;b date;moment timestamptz:=statement_timestamp();k text;options jsonb:='{}';result jsonb;begin
 select role='creative_analyst'into analyst from public.organization_memberships where user_id=auth.uid()and organization_id=org and active;
 if d is null or jsonb_typeof(d)<>'object' or exists(select 1 from jsonb_object_keys(d)input_key where input_key not in('from','to','brand','product','source','campaign')) or jsonb_typeof(d->'from')is distinct from 'string' or jsonb_typeof(d->'to')is distinct from 'string' or d->>'from'!~'^\d{4}-\d{2}-\d{2}$' or d->>'to'!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid report dates' using errcode='22023';end if;
 a=(d->>'from')::date;b=(d->>'to')::date;if a<'2000-01-01'or b>'2100-12-31'or b<a or b-a>365 then raise exception 'Choose 1-366 inclusive IST days' using errcode='22023';end if;
 lo=a::timestamp at time zone'Asia/Kolkata';hi=(b+1)::timestamp at time zone'Asia/Kolkata';
 if p_dimension is null or p_dimension not in('creative','ad','campaign','landing_page','form_version')or p_sort is null or p_sort not in('volume','conversion')or p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid report grouping/sort/page' using errcode='22023';end if;
 foreach k in array array['brand','product','source','campaign']loop
 if d?k and(jsonb_typeof(d->k)is distinct from 'string' or(d->>k not in('','unknown')and d->>k!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'))then raise exception 'Invalid configured attribution filter' using errcode='22023';end if;
 if k='campaign'then options=options||jsonb_build_object(k,coalesce((select jsonb_agg(x)from(select id value,name||case when archived then ' (archived)'else ''end label from public.ad_references where organization_id=org and kind='campaign'order by name,id limit 500)x),'[]'::jsonb));elsif k='source'then options=options||jsonb_build_object(k,coalesce((select jsonb_agg(x)from(select id value,name label from public.ingestion_sources where organization_id=org order by name,id limit 500)x),'[]'::jsonb));else options=options||jsonb_build_object(k,coalesce((select jsonb_agg(x)from(select id value,name||case when archived then ' (archived)'else ''end label from public.catalog_items where organization_id=org and kind=k order by name,id limit 500)x),'[]'::jsonb));end if;
 end loop;
 with cohort as materialized(
 select l.id,l.status_id,coalesce(p.historical_confirmed,false)historical_confirm,
 p.lead_id is not null historical_import,i.lead_id is not null and p.lead_id is null api_submission,
 coalesce(s.snapshot->>'coverage',case when i.lead_id is not null and crm_private.ad_reported_inputs(i)<>'{}'::jsonb then 'reported_unverified'else 'unknown'end)coverage,
 s.snapshot ads,i.source_id,i.source_snapshot cat,
 exists(select 1 from public.call_attempts c where c.organization_id=org and c.lead_id=l.id and c.attempted_at<=moment)called,
 exists(select 1 from public.confirmation_events e where e.organization_id=org and e.lead_id=l.id and e.confirmed_at<=moment)confirmed
 from public.leads l left join public.lead_ingestion i on i.lead_id=l.id and i.organization_id=org
 left join crm_private.ad_attribution_snapshots s on s.lead_id=l.id and s.organization_id=org
 left join public.lead_import_provenance p on p.lead_id=l.id and p.organization_id=org
 where l.organization_id=org and l.created_at>=lo and l.created_at<hi
 and(coalesce(d->>'brand','')=''or coalesce(i.source_snapshot->'configured_attribution'->'brand'->>'id','unknown')=d->>'brand')
 and(coalesce(d->>'product','')=''or coalesce(i.source_snapshot->'configured_attribution'->'product'->>'id','unknown')=d->>'product')
 and(coalesce(d->>'campaign','')=''or coalesce(s.snapshot->'campaign'->>'id','unknown')=d->>'campaign')
 and(coalesce(d->>'source','')=''or coalesce(i.source_id::text,'unknown')=d->>'source')
 ),dimensioned as materialized(
 select c.*,case
 when p_dimension in('creative','ad','campaign')then coalesce(ads->p_dimension->>'id',case when coverage='unknown'then 'unknown'else 'reported_unmapped'end)
 when p_dimension='landing_page'then coalesce(cat->'configured_attribution'->'landing_page'->>'id','unknown')
 else case when source_id is null then 'unknown'else source_id::text||':'||coalesce(cat->>'form_version','')end end group_key,
 case when p_dimension in('creative','ad','campaign')then coalesce(ads->p_dimension->>'name',case when coverage='unknown'then 'Unknown / no reviewed reference'else 'Reported/unverified; no reviewed reference in this dimension'end)
 when p_dimension='landing_page'then coalesce(cat->'configured_attribution'->'landing_page'->>'name','Unknown configured landing page')
 else case when source_id is null then 'Unknown source/version'else coalesce(cat->>'form_id','Configured source')||' / '||coalesce(nullif(cat->>'form_version',''),'(legacy unversioned)')end end label
 from cohort c
 ), grouped as materialized(
 select group_key,string_agg(distinct label,' / 'order by label)label,count(*)n,count(*)filter(where called)called,count(*)filter(where confirmed)confirmed,
 count(*)filter(where historical_confirm)historical_confirm,count(*)filter(where historical_import)historical_imports,count(*)filter(where api_submission)api_submissions,
 count(*)filter(where coverage='mapped')mapped,count(*)filter(where coverage='reported_unverified')reported,count(*)filter(where coverage='unknown')unknown
 from dimensioned group by group_key
 ), safe_rows as materialized(
 select g.group_key,g.label,
 case when analyst then(g.n/5)*5 else g.n end received,
 case when analyst then crm_private.ad_private_count(g.n,g.called)else g.called end called,
 case when analyst then crm_private.ad_private_count(g.n,g.confirmed)else g.confirmed end confirmed,
 case when analyst then case when g.confirmed>=5 and g.n-g.confirmed>=5 then round(100.0*((g.confirmed/5)*5)/nullif((g.n/5)*5,0)/10)*10 else null end else round(100.0*g.confirmed/nullif(g.n,0),2)end conversion,
 case when analyst then crm_private.ad_private_count(g.n,g.historical_confirm)else g.historical_confirm end historical_confirm,
 case when analyst then crm_private.ad_private_count(g.n,g.historical_imports)else g.historical_imports end historical_imports,
 case when analyst then crm_private.ad_private_count(g.n,g.api_submissions)else g.api_submissions end api_submissions,
 jsonb_build_object('mapped',case when analyst then crm_private.ad_private_count(g.n,g.mapped)else g.mapped end,'reported_unverified',case when analyst then crm_private.ad_private_count(g.n,g.reported)else g.reported end,'unknown',case when analyst then crm_private.ad_private_count(g.n,g.unknown)else g.unknown end)coverage,
 coalesce((select jsonb_agg(x order by x.label)from(select st.label,case when analyst then crm_private.ad_private_count(g.n,count(c.id))else count(c.id)end total from public.lead_statuses st left join dimensioned c on c.status_id=st.id and c.group_key=g.group_key where st.organization_id=org group by st.id,st.label)x),'[]'::jsonb)statuses
 from grouped g where not analyst or g.n>=5
 )
 select jsonb_build_object('role',case when analyst then 'analyst'else 'management'end,'as_of',moment,'options',options,'privacy',case when analyst then 'k=5; groups below 5 withheld; counts rounded down to 5; small/complementary cells suppressed; conversion bucketed to 10 percentage points; no hidden-group totals or customer drilldowns'else 'Exact organization aggregates; no claim of independently verified advertising origin'end,
 'totals',case when analyst then null else(select jsonb_build_object('received',count(*),'called',count(*)filter(where called),'confirmed',count(*)filter(where confirmed),'conversion',round(100.0*count(*)filter(where confirmed)/nullif(count(*),0),2),'historical_confirm',count(*)filter(where historical_confirm),'mapped',count(*)filter(where coverage='mapped'),'reported_unverified',count(*)filter(where coverage='reported_unverified'),'unknown',count(*)filter(where coverage='unknown'))from cohort)end,
 'groups_total',(select count(*)from safe_rows),'page',p_page,'rows',coalesce((select jsonb_agg(to_jsonb(x)order by case when p_sort='conversion'then x.conversion end desc nulls last,x.received desc,x.group_key)from(select * from safe_rows order by case when p_sort='conversion'then conversion end desc nulls last,received desc,group_key limit 20 offset(p_page-1)*20)x),'[]'::jsonb))into result;
 return result;
end$$;
notify pgrst,'reload schema';
commit;
