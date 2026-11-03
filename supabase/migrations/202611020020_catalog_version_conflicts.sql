begin;
-- Version row revisions alone cannot protect the shared source pointer.
create or replace function public.save_form_version(p_id uuid,p_revision integer,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid:=crm_private.import_admin();src public.ingestion_sources;v public.source_form_versions;result uuid;op text;begin
 perform pg_advisory_xact_lock(hashtextextended('catalog:'||org::text,0));
 if jsonb_typeof(p_input) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_input)x where x not in('source_id','version_key','landing_page_id','operation','source_revision')) then raise exception 'Invalid version input' using errcode='22023';end if;
 op=p_input->>'operation';select * into src from public.ingestion_sources where id=(p_input->>'source_id')::uuid and organization_id=org for update;
 if not found then raise exception 'Source unavailable' using errcode='42501';end if;
 if op in('activate','retire') and (p_input->>'source_revision')::integer is distinct from src.revision then raise exception 'Source version selection changed; reload before activation/retirement' using errcode='PT409';end if;
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
notify pgrst,'reload schema';
commit;
