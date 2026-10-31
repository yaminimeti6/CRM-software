begin;
-- Expose names only for actors on a lead the caller can already read, and only
-- while their profile still belongs to the same organization. Staff RLS stays intact.
create function public.lead_history_editors(p_lead_id uuid,p_editor_ids uuid[])
returns table(editor_id uuid,display_name text)
language sql stable security definer set search_path='' as $$
  select distinct h.editor_id,p.full_name
  from public.lead_edit_history h
  join public.staff_profiles p on p.id=h.editor_id
  join public.organization_memberships m on m.user_id=p.id and m.organization_id=h.organization_id
  where h.lead_id=p_lead_id and h.organization_id=public.lead_organization()
    and h.editor_id=any(p_editor_ids[1:20])
$$;
revoke all on function public.lead_history_editors(uuid,uuid[]) from public,anon;
grant execute on function public.lead_history_editors(uuid,uuid[]) to authenticated;
commit;
