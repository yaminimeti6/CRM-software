begin;
-- The stable list RPC must work in PostgREST read-only transactions.
-- Mutations retain the locked Admin helper; reads recheck active Admin without row locks.
create or replace function public.ad_attribution_admin(p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid;begin
 select organization_id into org from public.organization_memberships where user_id=auth.uid()and active and role='admin';
 if org is null then raise exception 'Active Admin required' using errcode='42501';end if;
 if p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid page' using errcode='22023';end if;
 return jsonb_build_object('references',coalesce((select jsonb_agg(x)from(select id,kind,name,external_id,campaign_id,creative_id,archived,revision from public.ad_references where organization_id=org order by created_at desc,id limit 20 offset(p_page-1)*20)x),'[]'::jsonb),
 'reference_total',(select count(*)from public.ad_references where organization_id=org),
 'mappings',coalesce((select jsonb_agg(x)from(select m.id,m.source_id,m.form_version,m.reported_kind,m.reported_value,m.reference_id,m.active,m.revision,m.reviewed_at,p.full_name reviewed_by from public.ad_mapping_rules m left join public.staff_profiles p on p.id=m.reviewed_by where m.organization_id=org order by m.reviewed_at desc,m.id limit 20 offset(p_page-1)*20)x),'[]'::jsonb),
 'mapping_total',(select count(*)from public.ad_mapping_rules where organization_id=org),
 'versions',coalesce((select jsonb_agg(x)from(select v.source_id,v.version_key,s.name source_name from public.source_form_versions v join public.ingestion_sources s on s.id=v.source_id and s.organization_id=org where v.organization_id=org order by s.name,v.version_key limit 500)x),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(x)from(select a.module,a.record_id,a.occurred_at,p.full_name actor,a.before_data,a.after_data from crm_private.ad_mapping_audit a left join public.staff_profiles p on p.id=a.actor_id where a.organization_id=org order by a.occurred_at desc,a.id limit 20 offset(p_page-1)*20)x),'[]'::jsonb),'audit_total',(select count(*)from crm_private.ad_mapping_audit where organization_id=org));
end$$;
notify pgrst,'reload schema';
commit;
