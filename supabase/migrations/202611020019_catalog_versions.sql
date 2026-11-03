begin;
-- Stable catalog identities. Parents cannot be moved after creation; archive, never delete.
create table public.catalog_items(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 kind text not null check(kind in('brand','product','landing_page')),parent_id uuid,
 name text not null check(length(trim(name)) between 1 and 100),url text not null default '',language text not null default '' check(length(language)<=40),
 archived boolean not null default false,revision integer not null default 1,created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 unique(organization_id,id),foreign key(organization_id,parent_id) references public.catalog_items(organization_id,id),
 check((kind='brand' and parent_id is null) or(kind<>'brand' and parent_id is not null)),
 check(url='' or(length(url)<=2048 and url ~ '^https?://[^[:space:]<>]+$')),
 check(kind='landing_page' or(url='' and language=''))
);
create unique index catalog_sibling_name on public.catalog_items(organization_id,kind,coalesce(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(trim(name)));
create table public.source_form_versions(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,source_id uuid not null,version_key text not null check(length(version_key)<=80),
 landing_page_id uuid,managed boolean not null default true,state text not null default 'draft' check(state in('draft','active','retired')),
 revision integer not null default 1,created_by uuid references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 unique(organization_id,id),unique(source_id,version_key),foreign key(organization_id,source_id) references public.ingestion_sources(organization_id,id) on delete cascade,
 foreign key(organization_id,landing_page_id) references public.catalog_items(organization_id,id),check(not managed or(length(trim(version_key))>0 and landing_page_id is not null))
);
-- Compatibility records describe old source configuration only; no lead backfill.
insert into public.source_form_versions(organization_id,source_id,version_key,managed,state,created_by)
 select organization_id,id,form_version,false,'active',created_by from public.ingestion_sources;
alter table public.import_batches add column configured_attribution jsonb;
alter table public.catalog_items enable row level security;alter table public.source_form_versions enable row level security;
revoke all on public.catalog_items,public.source_form_versions from public,anon,authenticated;
grant select on public.catalog_items,public.source_form_versions to authenticated;
create policy catalog_admin_read on public.catalog_items for select to authenticated using(exists(select 1 from public.organization_memberships m where m.organization_id=catalog_items.organization_id and m.user_id=auth.uid() and m.active and m.role='admin'));
create policy versions_admin_read on public.source_form_versions for select to authenticated using(exists(select 1 from public.organization_memberships m where m.organization_id=source_form_versions.organization_id and m.user_id=auth.uid() and m.active and m.role='admin'));
create function crm_private.catalog_snapshot(p_org uuid,p_source uuid,p_version text,p_live boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.source_form_versions;l public.catalog_items;p public.catalog_items;b public.catalog_items;begin
 select * into v from public.source_form_versions where organization_id=p_org and source_id=p_source and version_key=p_version for share;
 if not found then
  if p_live and exists(select 1 from public.source_form_versions where source_id=p_source and managed) then raise exception 'Explicit configured version required' using errcode='22023';end if;
  return null;
 end if;
 if p_live and v.state<>'active' then raise exception 'Form version retired or not active' using errcode='42501';end if;
 if not v.managed then return null;end if;
 select * into l from public.catalog_items where organization_id=p_org and id=v.landing_page_id and kind='landing_page' for share;
 select * into p from public.catalog_items where organization_id=p_org and id=l.parent_id and kind='product' for share;
 select * into b from public.catalog_items where organization_id=p_org and id=p.parent_id and kind='brand' for share;
 if b.id is null or(p_live and(l.archived or p.archived or b.archived)) then raise exception 'Catalog unavailable or archived' using errcode='42501';end if;
 return jsonb_build_object('brand',jsonb_build_object('id',b.id,'name',b.name),'product',jsonb_build_object('id',p.id,'name',p.name),'landing_page',jsonb_build_object('id',l.id,'name',l.name,'url',l.url,'language',l.language),'form_version',jsonb_build_object('id',v.id,'key',v.version_key));
end$$;
create function public.save_catalog_item(p_id uuid,p_revision integer,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid:=crm_private.import_admin();item public.catalog_items;parent public.catalog_items;result uuid;k text;pid uuid;u text;begin
 perform pg_advisory_xact_lock(hashtextextended('catalog:'||org::text,0));
 if jsonb_typeof(p_input) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_input)x where x not in('kind','parent_id','name','url','language','archived')) or jsonb_typeof(p_input->'name') is distinct from 'string' or jsonb_typeof(p_input->'archived') is distinct from 'boolean' then raise exception 'Invalid catalog input' using errcode='22023';end if;
 k=p_input->>'kind';pid=nullif(p_input->>'parent_id','')::uuid;u=coalesce(p_input->>'url','');
 if k not in('brand','product','landing_page') or length(trim(p_input->>'name')) not between 1 and 100 or length(coalesce(p_input->>'language',''))>40 or(u<>'' and(u !~ '^https?://[a-zA-Z0-9][^[:space:]<>]*$' or u~'://[^/]*@' or length(u)>2048)) then raise exception 'Invalid catalog fields/URL' using errcode='22023';end if;
 if k<>'landing_page' and(u<>'' or coalesce(p_input->>'language','')<>'') then raise exception 'Only landing pages have URL/language' using errcode='22023';end if;
 if k='brand' and pid is not null or k<>'brand' and pid is null then raise exception 'Parent required' using errcode='22023';end if;
 if p_id is not null then select * into item from public.catalog_items where id=p_id and organization_id=org for update;if not found or item.revision<>p_revision then raise exception 'Catalog changed' using errcode='PT409';end if;if item.kind<>k or item.parent_id is distinct from pid then raise exception 'Parent/type immutable; archive and create a new record' using errcode='22023';end if;else if p_revision<>0 then raise exception 'Invalid revision' using errcode='22023';end if;end if;
 if pid is not null then
 select * into parent from public.catalog_items where id=pid and organization_id=org and kind=case when k='product' then 'brand' else 'product' end for share;
 if not found then raise exception 'Invalid organization/parent' using errcode='42501';end if;
 if not(p_input->>'archived')::boolean and(parent.archived or(k='landing_page' and exists(select 1 from public.catalog_items where id=parent.parent_id and archived))) then raise exception 'Parent archived' using errcode='22023';end if;
 end if;
 if p_id is null then insert into public.catalog_items(organization_id,kind,parent_id,name,url,language,archived,created_by)values(org,k,pid,trim(p_input->>'name'),u,coalesce(p_input->>'language',''),(p_input->>'archived')::boolean,auth.uid())returning id into result;
 else update public.catalog_items set name=trim(p_input->>'name'),url=u,language=coalesce(p_input->>'language',''),archived=(p_input->>'archived')::boolean,revision=revision+1 where id=p_id returning id into result;end if;return result;
end$$;
create function public.save_form_version(p_id uuid,p_revision integer,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid:=crm_private.import_admin();src public.ingestion_sources;v public.source_form_versions;result uuid;op text;begin
 perform pg_advisory_xact_lock(hashtextextended('catalog:'||org::text,0));
 if jsonb_typeof(p_input) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_input)x where x not in('source_id','version_key','landing_page_id','operation')) then raise exception 'Invalid version input' using errcode='22023';end if;
 op=p_input->>'operation';select * into src from public.ingestion_sources where id=(p_input->>'source_id')::uuid and organization_id=org for update;
 if not found then raise exception 'Source unavailable' using errcode='42501';end if;
 if p_id is null then
 if op<>'create' or p_revision<>0 or length(trim(p_input->>'version_key')) not between 1 and 80 or not exists(select 1 from public.catalog_items where id=(p_input->>'landing_page_id')::uuid and organization_id=org and kind='landing_page' and not archived) then raise exception 'Valid new version and landing page required' using errcode='22023';end if;
 insert into public.source_form_versions(organization_id,source_id,version_key,landing_page_id,created_by)values(org,src.id,p_input->>'version_key',(p_input->>'landing_page_id')::uuid,auth.uid())returning id into result;
 perform crm_private.catalog_snapshot(org,src.id,p_input->>'version_key',false);return result;
 end if;
 select * into v from public.source_form_versions where id=p_id and organization_id=org and source_id=src.id for update;
 if not found or v.revision<>p_revision then raise exception 'Version changed' using errcode='PT409';end if;
 if op='activate' then
 if not v.managed then raise exception 'Legacy version has unknown catalog; create a new version' using errcode='22023';end if;
 -- Validate active ancestors before publishing; the source switch is one transaction.
 if exists(select 1 from public.catalog_items l join public.catalog_items p on p.id=l.parent_id join public.catalog_items b on b.id=p.parent_id where l.id=v.landing_page_id and(l.archived or p.archived or b.archived)) then raise exception 'Catalog archived' using errcode='22023';end if;
 update public.source_form_versions set state='retired',revision=revision+1 where source_id=src.id and state='active' and id<>v.id;
 update public.source_form_versions set state='active',revision=revision+1 where id=v.id;
 update public.ingestion_sources set form_version=v.version_key,revision=revision+1 where id=src.id;
 elsif op='retire' then update public.source_form_versions set state='retired',revision=revision+1 where id=v.id;
 else raise exception 'Use create, activate or retire; version identity/binding immutable' using errcode='22023';end if;
 return v.id;
end$$;
-- Existing source editor remains the single source module. Legacy sources keep working.
create function crm_private.catalog_source_version() returns trigger language plpgsql security definer set search_path='' as $$begin
 if TG_OP='UPDATE' and NEW.form_version=OLD.form_version then return NEW;end if;
 if not exists(select 1 from public.source_form_versions where source_id=NEW.id and version_key=NEW.form_version) then
  if exists(select 1 from public.source_form_versions where source_id=NEW.id and managed) then raise exception 'Create/activate explicit version in Catalog' using errcode='22023';end if;
  insert into public.source_form_versions(organization_id,source_id,version_key,managed,state,created_by)values(NEW.organization_id,NEW.id,NEW.form_version,false,'active',NEW.created_by);
 elsif not exists(select 1 from public.source_form_versions where source_id=NEW.id and version_key=NEW.form_version and state='active') then raise exception 'Activate version in Catalog first' using errcode='22023';end if;
 return NEW;
end$$;
create trigger catalog_source_version after insert or update of form_version on public.ingestion_sources for each row execute function crm_private.catalog_source_version();
-- Preview freezes attribution, so renames/config changes cannot alter a resumed import.
create function crm_private.catalog_import_snapshot() returns trigger language plpgsql security definer set search_path='' as $$begin
 if TG_OP='INSERT' or NEW.source_id is distinct from OLD.source_id or NEW.form_version is distinct from OLD.form_version then
 NEW.configured_attribution=crm_private.catalog_snapshot(NEW.organization_id,NEW.source_id,NEW.form_version,false);
 if NEW.configured_attribution is null and exists(select 1 from public.source_form_versions where source_id=NEW.source_id and managed) and not exists(select 1 from public.source_form_versions where source_id=NEW.source_id and version_key=NEW.form_version and not managed) then raise exception 'Select existing explicit import version' using errcode='22023';end if;
 end if;return NEW;
end$$;
create trigger catalog_import_snapshot before insert or update of source_id,form_version on public.import_batches for each row execute function crm_private.catalog_import_snapshot();
create function crm_private.catalog_receipt_snapshot() returns trigger language plpgsql security definer set search_path='' as $$declare snap jsonb;batch uuid;begin
 if NEW.source_snapshot->>'historical'='true' then
 batch=(NEW.source_snapshot->>'import_batch')::uuid;
 select configured_attribution into snap from public.import_batches where id=batch and organization_id=NEW.organization_id and source_id=NEW.source_id;
 else snap=crm_private.catalog_snapshot(NEW.organization_id,NEW.source_id,coalesce(NEW.source_snapshot->>'form_version',''),true);end if;
 NEW.source_snapshot=NEW.source_snapshot||jsonb_build_object('configured_attribution',snap);return NEW;
end$$;
create trigger catalog_receipt_snapshot before insert on public.lead_ingestion for each row execute function crm_private.catalog_receipt_snapshot();
-- Wrap the existing Step 7 deduplication path, rather than replacing it.
alter function public.ingest_public_lead(text,uuid,text,jsonb,jsonb,jsonb) rename to ingest_public_lead_v7;
alter function public.ingest_public_lead_v7(text,uuid,text,jsonb,jsonb,jsonb) set schema crm_private;
revoke all on function crm_private.ingest_public_lead_v7(text,uuid,text,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.ingest_public_lead(p_form text,p_submission uuid,p_origin text,p_original jsonb,p_lead jsonb,p_metadata jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare src public.ingestion_sources;prior public.lead_ingestion;begin
 select * into src from public.ingestion_sources where form_id=p_form for share;
 if src.id is null or not src.enabled or not(src.allowed_origins?p_origin) then raise exception 'Source unavailable' using errcode='42501';end if;
 select * into prior from public.lead_ingestion where source_id=src.id and submission_id=p_submission;
 if prior.lead_id is null then
 if exists(select 1 from public.source_form_versions where source_id=src.id and managed) and (not(p_original?'form_version') or p_original->>'form_version' is distinct from src.form_version) then raise exception 'Form changed; reload current form version' using errcode='PT409';end if;
 perform crm_private.catalog_snapshot(src.organization_id,src.id,src.form_version,true);
 end if;
 return crm_private.ingest_public_lead_v7(p_form,p_submission,p_origin,p_original,p_lead,p_metadata);
end$$;
revoke all on function public.ingest_public_lead(text,uuid,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_public_lead(text,uuid,text,jsonb,jsonb,jsonb) to service_role;
revoke all on function crm_private.catalog_snapshot(uuid,uuid,text,boolean),crm_private.catalog_source_version(),crm_private.catalog_import_snapshot(),crm_private.catalog_receipt_snapshot() from public,anon,authenticated,service_role;
revoke all on function public.save_catalog_item(uuid,integer,jsonb),public.save_form_version(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_catalog_item(uuid,integer,jsonb),public.save_form_version(uuid,integer,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
