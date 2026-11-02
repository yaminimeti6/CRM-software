begin;
-- Hold active actor/assignee membership stable until each operational transaction
-- commits. Concurrent deactivation then clears any presence after the write.
create function crm_private.lock_operational_actor() returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid;begin
 select organization_id into org from public.organization_memberships where user_id=auth.uid() and active and role in('admin','manager','telecaller') for share;
 if org is null then raise exception 'Operational staff required' using errcode='42501';end if;return org;
end $$;
revoke all on function crm_private.lock_operational_actor() from public,anon,authenticated,service_role;
do $$declare signature text;definition text;begin
 foreach signature in array array['public.save_follow_up(uuid,uuid,integer,uuid,jsonb)','public.log_lead_call(uuid,integer,uuid,jsonb)','public.log_call_with_follow_up(uuid,integer,uuid,jsonb,jsonb)','public.set_calling_presence(uuid,uuid,uuid,integer,text)','crm_private.mutate_follow_up(uuid,uuid,integer,jsonb,uuid)'] loop
  definition=pg_get_functiondef(signature::regprocedure);
  if position('org uuid:=public.lead_organization()' in definition)=0 then raise exception 'Unexpected prior Step 5 function';end if;
  definition=replace(definition,'org uuid:=public.lead_organization()','org uuid:=crm_private.lock_operational_actor()');
  if signature like 'crm_private.mutate_follow_up%' then
   definition=replace(definition,'if assignee is not null and not exists(select 1 from public.organization_memberships where user_id=assignee and organization_id=org and active and role in(''admin'',''manager'',''telecaller'')) then raise exception ''Choose an active operational assignee'' using errcode=''22023'';end if;',
    'if assignee is not null then perform 1 from public.organization_memberships where user_id=assignee and organization_id=org and active and role in(''admin'',''manager'',''telecaller'') for share; if not found then raise exception ''Choose an active operational assignee'' using errcode=''22023'';end if;end if;');
  end if;
  execute definition;
 end loop;
end$$;
notify pgrst,'reload schema';commit;
