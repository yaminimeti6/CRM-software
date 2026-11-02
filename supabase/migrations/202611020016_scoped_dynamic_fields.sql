begin;
create table public.source_quiz_fields(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,source_id uuid not null,form_version text not null,
 field_key text not null check(length(trim(field_key)) between 1 and 80),created_at timestamptz not null default clock_timestamp(),
 unique(organization_id,source_id,form_version,field_key),foreign key(organization_id,source_id) references public.ingestion_sources(organization_id,id) on delete cascade
);
alter table public.source_quiz_fields enable row level security;
revoke all on public.source_quiz_fields from public,anon,authenticated;grant select on public.source_quiz_fields to authenticated;
create policy source_quiz_fields_read on public.source_quiz_fields for select to authenticated using(organization_id=(select public.lead_organization()));
-- Backfill identities only. Never rewrite a lead, original answer, receipt or audit.
insert into public.source_quiz_fields(organization_id,source_id,form_version,field_key)
 select distinct i.organization_id,i.source_id,coalesce(i.source_snapshot->>'form_version',''),k.key
 from public.lead_ingestion i join public.leads l on l.id=i.lead_id and l.organization_id=i.organization_id
 cross join lateral jsonb_object_keys(i.original_answers||l.answers) k(key) on conflict do nothing;
insert into public.source_quiz_fields(organization_id,source_id,form_version,field_key)
 select distinct i.organization_id,i.source_id,coalesce(i.source_snapshot->>'form_version',''),k.key
 from public.lead_ingestion i join public.lead_edit_history h on h.lead_id=i.lead_id and h.organization_id=i.organization_id
 cross join lateral jsonb_object_keys(coalesce(nullif(h.changes->'answers'->'before','null'::jsonb),'{}'::jsonb)||coalesce(nullif(h.changes->'answers'->'after','null'::jsonb),'{}'::jsonb)) k(key) on conflict do nothing;
create function crm_private.register_source_quiz_fields() returns trigger language plpgsql security definer set search_path='' as $$
declare source uuid;version_text text;org uuid;values_json jsonb;begin
 if TG_TABLE_NAME='lead_ingestion' then source=NEW.source_id;version_text=coalesce(NEW.source_snapshot->>'form_version','');org=NEW.organization_id;values_json=NEW.original_answers||(select l.answers from public.leads l where l.id=NEW.lead_id and l.organization_id=NEW.organization_id);
 else
 select i.source_id,coalesce(i.source_snapshot->>'form_version',''),i.organization_id into source,version_text,org from public.lead_ingestion i where i.lead_id=NEW.id and i.organization_id=NEW.organization_id;
 if source is null then return NEW;end if;values_json=NEW.answers;
 end if;
 insert into public.source_quiz_fields(organization_id,source_id,form_version,field_key) select org,source,version_text,key from jsonb_object_keys(values_json) key on conflict do nothing;
 return NEW;
end $$;
revoke all on function crm_private.register_source_quiz_fields() from public,anon,authenticated,service_role;
create trigger ingestion_quiz_fields after insert on public.lead_ingestion for each row execute function crm_private.register_source_quiz_fields();
create trigger edited_source_quiz_fields after update of answers on public.leads for each row execute function crm_private.register_source_quiz_fields();
-- Keep existing manual/unclassified definitions, but stop public inquiries from
-- registering new questions in the unscoped namespace before metadata insertion.
do $$declare definition text;needle text:='insert into public.lead_field_definitions(organization_id,field_key) select NEW.organization_id,key from jsonb_object_keys(NEW.answers) key on conflict do nothing;';begin
 definition=pg_get_functiondef('crm_private.record_lead_edit()'::regprocedure);
 if position(needle in definition)=0 then raise exception 'Unexpected audit definition; refusing replacement';end if;
 execute replace(definition,needle,'if NEW.created_by is not null then '||needle||' end if;');
end $$;
create function public.quiz_columns() returns table(id text,field_key text,label text,source_id uuid,form_version text) language plpgsql stable security definer set search_path='' as $$
declare org uuid:=public.lead_organization();begin
 if org is null then raise exception 'Operational staff required' using errcode='42501';end if;
 return query
 select 'manual:'||d.field_key,d.field_key,d.field_key,null::uuid,null::text from public.lead_field_definitions d where d.organization_id=org and (
 not exists(select 1 from public.source_quiz_fields f where f.organization_id=org and f.field_key=d.field_key)
 or exists(select 1 from public.leads l where l.organization_id=org and l.created_by is not null and (l.answers?d.field_key or exists(select 1 from public.lead_edit_history h where h.lead_id=l.id and h.organization_id=org and ((h.changes->'answers'->'before')?d.field_key or(h.changes->'answers'->'after')?d.field_key)))))
 union all
 select f.id::text,f.field_key,f.field_key||' ['||s.form_id||' / '||case when f.form_version='' then '(unversioned)' else f.form_version end||']',f.source_id,f.form_version
 from public.source_quiz_fields f join public.ingestion_sources s on s.id=f.source_id and s.organization_id=f.organization_id where f.organization_id=org
 order by 3,1;
end $$;
revoke all on function public.quiz_columns() from public,anon;grant execute on function public.quiz_columns() to authenticated;
notify pgrst,'reload schema';commit;
