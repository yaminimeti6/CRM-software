begin;
-- Only this explicitly configured source version uses the CodLive legacy UTM aliases.
create function crm_private.codlive_receipt() returns trigger language plpgsql set search_path='' as $$
declare raw jsonb; traffic text;
begin
 if NEW.source_snapshot->>'form_version' = 'codlive-v1' and NEW.source_snapshot->>'historical' is distinct from 'true' then
  raw=NEW.raw_advertising;
  traffic=coalesce(nullif(trim(raw->>'campId'),''),'Unknown');
  NEW.normalized_attribution=jsonb_build_object('utm_source',coalesce(raw->>'campId',''),'utm_medium',coalesce(raw->>'place',''),'utm_campaign',coalesce(raw->>'AdCrevId',''),'utm_content',coalesce(raw->>'AdCrevName',''),'utm_term',coalesce(raw->>'utm_term',''),'reported_traffic_source',traffic);
  NEW.source_snapshot=NEW.source_snapshot||jsonb_build_object('reported_traffic_source',traffic,'tracking_profile','codlive-v1');
 end if;
 return NEW;
end$$;
revoke all on function crm_private.codlive_receipt() from public,anon,authenticated,service_role;
create trigger codlive_receipt before insert on public.lead_ingestion for each row execute function crm_private.codlive_receipt();
commit;
