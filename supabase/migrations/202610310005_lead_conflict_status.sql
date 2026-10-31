begin;
-- Application version conflicts use HTTP 409, not a retriable transaction error.
create or replace function public.update_lead(p_id uuid,p_version integer,p_input jsonb) returns public.leads
language plpgsql security definer set search_path='' as $$
declare org uuid; current_lead public.leads; result public.leads; target_status uuid;
begin
  org=public.lead_organization();
  if org is null then raise exception 'Operational staff required' using errcode='42501'; end if;
  perform crm_private.validate_lead_input(p_input);
  select * into current_lead from public.leads where id=p_id and organization_id=org for update;
  if not found then raise exception 'Lead unavailable' using errcode='42501'; end if;
  if p_version is null or current_lead.version<>p_version then raise exception 'Lead changed. Reload before editing.' using errcode='PT409'; end if;
  target_status=coalesce((p_input->>'status_id')::uuid,current_lead.status_id);
  if not exists(select 1 from public.lead_statuses where id=target_status and organization_id=org and (active or id=current_lead.status_id)) then raise exception 'Status unavailable' using errcode='22023'; end if;
  if current_lead.name=trim(p_input->>'name') and current_lead.mobile_no=trim(p_input->>'mobile_no')
    and current_lead.address=coalesce(p_input->>'address','') and current_lead.notes=coalesce(p_input->>'notes','')
    and current_lead.answers=coalesce(p_input->'answers','{}') and current_lead.status_id=target_status then return current_lead; end if;
  update public.leads set name=trim(p_input->>'name'),mobile_no=trim(p_input->>'mobile_no'),address=coalesce(p_input->>'address',''),notes=coalesce(p_input->>'notes',''),answers=coalesce(p_input->'answers','{}'),status_id=target_status,version=version+1,updated_at=clock_timestamp()
    where id=p_id and organization_id=org returning * into result;
  return result;
end $$;
commit;
