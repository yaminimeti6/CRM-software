begin;
-- Parameters are literal text: punctuation never becomes PostgREST filter syntax
-- or SQL wildcard syntax. Invoker permissions and table RLS remain in force.
create function public.search_leads(p_search text default '',p_status uuid default null,p_offset integer default 0,p_limit integer default 20)
returns jsonb language sql stable security invoker set search_path='' as $$
  with filtered as materialized (
    select l.* from public.leads l
    where (p_status is null or l.status_id=p_status)
      and (coalesce(p_search,'')='' or strpos(lower(l.name),lower(left(p_search,80)))>0 or strpos(l.mobile_no,left(p_search,80))>0)
  ), page as (
    select * from filtered order by created_at desc,id desc
    limit least(greatest(p_limit,1),50) offset least(greatest(p_offset,0),5000000)
  )
  select jsonb_build_object('total',(select count(*) from filtered),'leads',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb))
$$;
revoke all on function public.search_leads(text,uuid,integer,integer) from public,anon;
grant execute on function public.search_leads(text,uuid,integer,integer) to authenticated;
commit;
