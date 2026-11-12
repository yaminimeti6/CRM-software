begin;
create or replace function public.save_workspace_setting(p_kind text,p_id uuid,p_revision integer,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=public.lead_organization();old_status public.lead_statuses;new_status public.lead_statuses;old_setting public.crm_workspace_settings;layout jsonb;keys text[]:=array['name','mobile','status','course','source','traffic','received','address','notes','actions'];entry record;next_category text;begin
 if org is null or not exists(select 1 from public.organization_memberships where user_id=auth.uid() and organization_id=org and active and role='admin')then raise exception 'Admin required' using errcode='42501';end if;
 perform 1 from public.organizations where id=org for update;
 if p_revision is null or p_revision<0 or p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'Invalid settings' using errcode='22023';end if;
 if p_kind='status' then
 if (select array_agg(k order by k) from jsonb_object_keys(p_input)k)<>array['active','category','color','label','sort_order'] or jsonb_typeof(p_input->'active')<>'boolean' or length(trim(p_input->>'label'))not between 1 and 80 or p_input->>'color'!~'^#[a-fA-F0-9]{6}$' or coalesce(p_input->>'category','')not in('new','other','confirmed','cancelled') or coalesce(p_input->>'sort_order','')!~'^-?[0-9]{1,6}$' then raise exception 'Invalid status settings' using errcode='22023';end if;
 next_category=p_input->>'category';
 if p_id is not null then
 select * into old_status from public.lead_statuses where id=p_id and organization_id=org for update;
 if not found then raise exception 'Unavailable status' using errcode='42501';end if;
 if old_status.revision<>p_revision then raise exception 'Status changed' using errcode='PT409';end if;
 if old_status.category in('new','confirmed') and (next_category<>old_status.category or not(p_input->>'active')::boolean)then raise exception 'New and Confirm must remain active with their category' using errcode='22023';end if;
 if next_category<>old_status.category and(exists(select 1 from public.leads where status_id=p_id)or exists(select 1 from public.call_attempts where previous_status_id=p_id or outcome_status_id=p_id)or exists(select 1 from public.lead_edit_history where organization_id=org and changes::text like '%'||p_id::text||'%'))then raise exception 'Used status categories cannot be remapped; create a new status' using errcode='22023';end if;
 update public.lead_statuses set label=trim(p_input->>'label'),active=(p_input->>'active')::boolean,category=next_category,color=p_input->>'color',sort_order=(p_input->>'sort_order')::integer,revision=revision+1 where id=p_id returning * into new_status;
 else
 if p_revision<>0 or next_category in('new','confirmed')then raise exception 'Choose other or cancelled for a new status; system categories already exist' using errcode='22023';end if;
 insert into public.lead_statuses(organization_id,label,active,category,color,sort_order)values(org,trim(p_input->>'label'),(p_input->>'active')::boolean,next_category,p_input->>'color',(p_input->>'sort_order')::integer)returning * into new_status;
 end if;
 insert into public.crm_settings_history(organization_id,actor_id,kind,before_value,after_value)values(org,auth.uid(),'status',case when p_id is null then null else to_jsonb(old_status)end,to_jsonb(new_status));return to_jsonb(new_status);
 elsif p_kind='columns' then
 layout=jsonb_build_object('quiz','[]'::jsonb)||p_input;
 if (select array_agg(k order by k)from jsonb_object_keys(layout)k)<>array['hidden','order','quiz','widths'] or jsonb_typeof(layout->'order')<>'array' or jsonb_array_length(layout->'order')<>10 or (select count(distinct v)from jsonb_array_elements_text(layout->'order')v)<>10 or exists(select 1 from jsonb_array_elements_text(layout->'order')v where not(v=any(keys)))or layout->'order'->>0<>'name' or layout->'order'->>1<>'mobile' or layout->'order'->>9<>'actions' or jsonb_typeof(layout->'hidden')<>'array' or exists(select 1 from jsonb_array_elements_text(layout->'hidden')v where v is null or not(v=any(keys))or v in('name','mobile','actions'))or jsonb_typeof(layout->'widths')<>'object' then raise exception 'Invalid column layout' using errcode='22023';end if;
 for entry in select * from jsonb_each_text(layout->'widths')loop if entry.value is null or not(entry.key=any(keys))or entry.value!~'^[0-9]{3}$' or entry.value::integer not between 100 and 600 then raise exception 'Invalid width' using errcode='22023';end if;end loop;
 if jsonb_typeof(layout->'quiz')<>'array' or jsonb_array_length(layout->'quiz')>100 or (select count(distinct v)from jsonb_array_elements_text(layout->'quiz')v)<>jsonb_array_length(layout->'quiz')or exists(select 1 from jsonb_array_elements_text(layout->'quiz')v where v is null or not exists(select 1 from public.quiz_columns()f where f.id=v))then raise exception 'Unavailable answer column'using errcode='22023';end if;
 select * into old_setting from public.crm_workspace_settings where organization_id=org for update;
 if coalesce(old_setting.revision,0)<>p_revision then raise exception 'Defaults changed' using errcode='PT409';end if;
 insert into public.crm_workspace_settings(organization_id,columns,updated_by)values(org,layout,auth.uid())on conflict(organization_id)do update set columns=excluded.columns,revision=public.crm_workspace_settings.revision+1,updated_by=auth.uid(),updated_at=now();
 insert into public.crm_settings_history(organization_id,actor_id,kind,before_value,after_value)values(org,auth.uid(),'columns',old_setting.columns,layout);return(select to_jsonb(s)from public.crm_workspace_settings s where organization_id=org);
 end if;raise exception 'Unknown setting' using errcode='22023';
end$$;


notify pgrst,'reload schema';commit;
