begin;
create table public.ingestion_sources(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100),form_id text not null unique check(form_id ~ '^[a-zA-Z0-9_-]{8,100}$'),form_version text not null default '' check(length(form_version)<=80),
 allowed_origins jsonb not null check(jsonb_typeof(allowed_origins)='array' and jsonb_array_length(allowed_origins) between 1 and 10),enabled boolean not null default false,
 brand_reference text not null default '' check(length(brand_reference)<=100),product_reference text not null default '' check(length(product_reference)<=100),revision integer not null default 1,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),unique(organization_id,id)
);
create table public.ingestion_source_stats(source_id uuid primary key references public.ingestion_sources(id) on delete cascade,organization_id uuid not null references public.organizations(id) on delete cascade,accepted bigint not null default 0,rejected bigint not null default 0,retries bigint not null default 0,last_accepted_at timestamptz);
-- A public inquiry has no staff creator. Existing staff identities/history remain intact.
alter table public.leads alter column created_by drop not null;
alter table public.lead_edit_history alter column editor_id drop not null;
create table public.lead_ingestion(
 lead_id uuid primary key,organization_id uuid not null,source_id uuid not null,submission_id uuid not null,
 received_at timestamptz not null default clock_timestamp(),external_lead_id text not null default '',source_timestamp text not null default '',
 original_submission jsonb not null,original_answers jsonb not null,raw_advertising jsonb not null,normalized_attribution jsonb not null,source_snapshot jsonb not null,
 legacy_otp_label jsonb,otp_trusted boolean not null default false check(otp_trusted=false),is_repeat boolean not null,
 unique(source_id,submission_id),foreign key(organization_id,lead_id) references public.leads(organization_id,id) on delete cascade,foreign key(organization_id,source_id) references public.ingestion_sources(organization_id,id)
);
create table crm_private.ingestion_limits(bucket text primary key,window_start timestamptz not null,attempts integer not null);
revoke all on crm_private.ingestion_limits from public,anon,authenticated,service_role;
alter table public.ingestion_sources enable row level security;alter table public.ingestion_source_stats enable row level security;alter table public.lead_ingestion enable row level security;
revoke all on public.ingestion_sources,public.ingestion_source_stats,public.lead_ingestion from public,anon,authenticated;
grant select on public.ingestion_sources,public.ingestion_source_stats,public.lead_ingestion to authenticated;
create policy sources_admin on public.ingestion_sources for select to authenticated using(exists(select 1 from public.organization_memberships where organization_id=ingestion_sources.organization_id and user_id=auth.uid() and active and role='admin'));
create policy source_stats_admin on public.ingestion_source_stats for select to authenticated using(exists(select 1 from public.organization_memberships where organization_id=ingestion_source_stats.organization_id and user_id=auth.uid() and active and role='admin'));
create policy ingestion_lead_read on public.lead_ingestion for select to authenticated using(organization_id=(select public.lead_organization()));
create function public.save_ingestion_source(p_id uuid,p_revision integer,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid;result uuid;origin text;begin
 select organization_id into org from public.organization_memberships where user_id=auth.uid() and active and role='admin' for share;
 if org is null then raise exception 'Admin required' using errcode='42501';end if;
 if jsonb_typeof(p_input) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in('name','form_id','form_version','allowed_origins','enabled','brand_reference','product_reference')) or jsonb_typeof(p_input->'name') is distinct from 'string' or jsonb_typeof(p_input->'form_id') is distinct from 'string' or jsonb_typeof(p_input->'enabled') is distinct from 'boolean' or jsonb_typeof(p_input->'allowed_origins') is distinct from 'array' then raise exception 'Invalid source' using errcode='22023';end if;
 for origin in select jsonb_array_elements_text(p_input->'allowed_origins') loop
 if length(origin)>250 or origin !~ '^https://[a-zA-Z0-9.-]+(:[0-9]{1,5})?$' and origin !~ '^http://(localhost|127\.0\.0\.1)(:[0-9]{1,5})?$' then raise exception 'Exact HTTPS or local origin required' using errcode='22023';end if;end loop;
 if p_id is null then
 if p_revision<>0 then raise exception 'Invalid revision' using errcode='22023';end if;
 insert into public.ingestion_sources(organization_id,name,form_id,form_version,allowed_origins,enabled,brand_reference,product_reference,created_by) values(org,trim(p_input->>'name'),p_input->>'form_id',coalesce(p_input->>'form_version',''),p_input->'allowed_origins',(p_input->>'enabled')::boolean,coalesce(p_input->>'brand_reference',''),coalesce(p_input->>'product_reference',''),auth.uid()) returning id into result;
 insert into public.ingestion_source_stats(source_id,organization_id) values(result,org);
 else
 update public.ingestion_sources set name=trim(p_input->>'name'),form_id=p_input->>'form_id',form_version=coalesce(p_input->>'form_version',''),allowed_origins=p_input->'allowed_origins',enabled=(p_input->>'enabled')::boolean,brand_reference=coalesce(p_input->>'brand_reference',''),product_reference=coalesce(p_input->>'product_reference',''),revision=revision+1 where id=p_id and organization_id=org and revision=p_revision and form_id=p_input->>'form_id' returning id into result;
 if result is null then raise exception 'Source changed or unavailable' using errcode='PT409';end if;
 end if;return result;
end $$;
revoke all on function public.save_ingestion_source(uuid,integer,jsonb) from public,anon;grant execute on function public.save_ingestion_source(uuid,integer,jsonb) to authenticated;
create function public.ingestion_source(p_form text) returns jsonb language sql stable security definer set search_path='' as $$select to_jsonb(s) from public.ingestion_sources s where form_id=p_form$$;
create function public.ingestion_limit(p_bucket text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;moment timestamptz:=clock_timestamp();begin
 if length(p_bucket)<>64 or p_limit not between 1 and 500 or p_seconds not between 1 and 3600 then raise exception 'Invalid limit' using errcode='22023';end if;
 insert into crm_private.ingestion_limits values(p_bucket,moment,1) on conflict(bucket) do update set attempts=case when ingestion_limits.window_start<=moment-make_interval(secs=>p_seconds) then 1 else ingestion_limits.attempts+1 end,window_start=case when ingestion_limits.window_start<=moment-make_interval(secs=>p_seconds) then moment else ingestion_limits.window_start end returning attempts into n;
 -- Opportunistic expiry bounds durable abuse metadata; never customer payloads.
 delete from crm_private.ingestion_limits where window_start<moment-interval '2 hours';return n<=p_limit;
end $$;
create function public.ingestion_rejected(p_form text) returns void language sql security definer set search_path='' as $$update public.ingestion_source_stats set rejected=rejected+1 where source_id=(select id from public.ingestion_sources where form_id=p_form)$$;
create function public.ingest_public_lead(p_form text,p_submission uuid,p_origin text,p_original jsonb,p_lead jsonb,p_metadata jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare src public.ingestion_sources;prior public.lead_ingestion;initial uuid;new_id uuid;moment timestamptz;repeat_lead boolean;digits text;begin
 select * into src from public.ingestion_sources where form_id=p_form for share;
 if not found or not src.enabled or not(src.allowed_origins ? p_origin) then raise exception 'Source unavailable' using errcode='42501';end if;
 if p_submission is null or octet_length(p_original::text)>40000 or jsonb_typeof(p_original) is distinct from 'object' then raise exception 'Invalid inquiry' using errcode='22023';end if;
 perform crm_private.validate_lead_input(p_lead);
 if p_lead?'status_id' or p_lead?'notes' or exists(select 1 from jsonb_object_keys(p_metadata) k where k not in('original_answers','raw_advertising','normalized_attribution','legacy_otp_label','external_lead_id','source_timestamp')) then raise exception 'Protected inquiry fields' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('ingest:'||src.id::text||p_submission::text,0));
 select * into prior from public.lead_ingestion where source_id=src.id and submission_id=p_submission;
 if found then
 if prior.original_submission<>p_original then raise exception 'Submission ID conflicts with earlier inquiry' using errcode='PT409';end if;
 update public.ingestion_source_stats set retries=retries+1 where source_id=src.id;return jsonb_build_object('accepted',true,'replayed',true,'submission_id',p_submission);end if;
 digits=regexp_replace(p_lead->>'mobile_no','[^0-9]','','g');perform pg_advisory_xact_lock(hashtextextended('ingest-phone:'||src.organization_id::text||digits,0));
 repeat_lead=exists(select 1 from public.leads where organization_id=src.organization_id and regexp_replace(mobile_no,'[^0-9]','','g')=digits);
 select id into initial from public.lead_statuses where organization_id=src.organization_id and is_new and active;
 if initial is null then raise exception 'New status unavailable' using errcode='22023';end if;
 moment=clock_timestamp();insert into public.leads(organization_id,name,mobile_no,address,answers,status_id,created_by,created_at,updated_at) values(src.organization_id,trim(p_lead->>'name'),trim(p_lead->>'mobile_no'),coalesce(p_lead->>'address',''),p_lead->'answers',initial,null,moment,moment) returning id into new_id;
 insert into public.lead_ingestion(lead_id,organization_id,source_id,submission_id,received_at,external_lead_id,source_timestamp,original_submission,original_answers,raw_advertising,normalized_attribution,source_snapshot,legacy_otp_label,is_repeat)
 values(new_id,src.organization_id,src.id,p_submission,moment,coalesce(p_metadata->>'external_lead_id',''),coalesce(p_metadata->>'source_timestamp',''),p_original,p_metadata->'original_answers',p_metadata->'raw_advertising',p_metadata->'normalized_attribution',jsonb_build_object('name',src.name,'form_id',src.form_id,'form_version',src.form_version,'brand_reference',src.brand_reference,'product_reference',src.product_reference),p_metadata->'legacy_otp_label',repeat_lead);
 update public.ingestion_source_stats set accepted=accepted+1,last_accepted_at=moment where source_id=src.id;
 return jsonb_build_object('accepted',true,'replayed',false,'submission_id',p_submission);
end $$;
revoke all on function public.ingestion_source(text),public.ingestion_limit(text,integer,integer),public.ingestion_rejected(text),public.ingest_public_lead(text,uuid,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ingestion_source(text),public.ingestion_limit(text,integer,integer),public.ingestion_rejected(text),public.ingest_public_lead(text,uuid,text,jsonb,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';commit;
