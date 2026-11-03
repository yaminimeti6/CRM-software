begin;
-- Optional blank legacy aliases are not conflicting identities.
-- Filter derived matching inputs only; original raw values and prior snapshots are untouched.
create or replace function crm_private.ad_reported_inputs(i public.lead_ingestion)returns jsonb language plpgsql stable set search_path='' as $$
declare raw jsonb:='{}';k text;c jsonb;v jsonb;bid uuid;begin
 foreach k in array array['AdCrevId','creative_id','ad_id','campId','campaign_id','AdCrevName','FbClickId','utm_campaign']loop
  if i.raw_advertising?k then raw=raw||jsonb_build_object(k,i.raw_advertising->k);elsif i.original_answers?k then raw=raw||jsonb_build_object(k,i.original_answers->k);end if;
 end loop;
 if i.source_snapshot->>'historical'='true' then
 bid=nullif(i.source_snapshot->>'import_batch','')::uuid;
 for c in select x from public.import_batches b cross join lateral jsonb_array_elements(b.config->'columns')x where b.id=bid and b.organization_id=i.organization_id and x->>'role'='tracking'loop
 k=c->>'key';if k=any(array['AdCrevId','creative_id','ad_id','campId','campaign_id','AdCrevName','FbClickId','utm_campaign'])and i.raw_advertising?(c->>'id')then
 v=i.raw_advertising->(c->>'id');if raw?k and raw->k is distinct from v then raw=raw||jsonb_build_object(k,jsonb_build_array(raw->k,v));else raw=raw||jsonb_build_object(k,v);end if;
 end if;end loop;end if;
 return coalesce((select jsonb_object_agg(x.key,x.value)from jsonb_each(raw)x where x.value<>'null'::jsonb and x.value<>'""'::jsonb),'{}'::jsonb);
end$$;
notify pgrst,'reload schema';
commit;
