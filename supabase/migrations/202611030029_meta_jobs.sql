begin;
do $$begin if not exists(select 1 from pg_roles where rolname='crm_meta_worker')then create role crm_meta_worker nologin noinherit nosuperuser nobypassrls;end if;if not exists(select 1 from pg_roles where rolname='crm_meta_runtime')then create role crm_meta_runtime login inherit nosuperuser nobypassrls;end if;end$$;
grant crm_meta_worker to crm_meta_runtime;
grant usage on schema public to crm_meta_worker;
do $$begin execute format('grant connect on database %I to crm_meta_runtime',current_database());end$$;
create function public.crm_meta_claim()returns jsonb language plpgsql security definer set search_path=''as $$declare due_account record;claimed crm_private.meta_jobs;begin
 update crm_private.meta_jobs j set state='cancelled',lease=null,error_code='connection_changed'where state in('queued','running','retry')and not exists(select 1 from crm_private.meta_connections c join crm_private.meta_accounts a on a.organization_id=c.organization_id and a.id=j.account_id where c.organization_id=j.organization_id and c.state='verified'and c.generation=j.generation and c.expires_at>now()and a.selected and a.generation=c.generation and exists(select 1 from public.organization_memberships where user_id=c.connected_by and organization_id=c.organization_id and active and role='admin'));
 for due_account in select a.organization_id,a.id from crm_private.meta_accounts a join crm_private.meta_connections c on c.organization_id=a.organization_id and c.generation=a.generation where a.selected and a.next_due_at<=now()and c.state='verified'and c.expires_at>now()and exists(select 1 from public.organization_memberships where user_id=c.connected_by and organization_id=c.organization_id and active and role='admin')limit 20 loop perform crm_private.meta_enqueue(due_account.organization_id,due_account.id);end loop;
 select * into claimed from crm_private.meta_jobs where(state in('queued','retry')and next_attempt_at<=now())or(state='running'and lease_until<=now())order by created_at,id for update skip locked limit 1;
 if not found then return null;end if;update crm_private.meta_jobs set state='running',lease=gen_random_uuid(),lease_until=now()+interval '120 seconds',updated_at=now()where id=claimed.id returning * into claimed;
 return to_jsonb(claimed)||jsonb_build_object('ciphertext',(select ciphertext from crm_private.meta_connections where organization_id=claimed.organization_id));
end$$;
create function crm_private.meta_fence(p_job uuid,p_lease uuid)returns crm_private.meta_jobs language plpgsql security definer set search_path=''as $$declare j crm_private.meta_jobs;begin
 select * into j from crm_private.meta_jobs where id=p_job for update;
 if j.state<>'running'or j.lease is distinct from p_lease or j.lease_until<=now()or not exists(select 1 from crm_private.meta_connections c join crm_private.meta_accounts a on a.organization_id=c.organization_id and a.id=j.account_id where c.organization_id=j.organization_id and c.generation=j.generation and c.state='verified'and c.expires_at>now()and a.selected and exists(select 1 from public.organization_memberships where user_id=c.connected_by and organization_id=c.organization_id and role='admin'and active))then raise exception 'Stale job lease or connection'using errcode='PT409';end if;return j;
end$$;
create function public.crm_meta_page(p_job uuid,p_lease uuid,p_stage integer,p_cursor text,p_after text,p_rows jsonb)returns jsonb language plpgsql security definer set search_path=''as $$declare j crm_private.meta_jobs;r jsonb;k text;begin
 j=crm_private.meta_fence(p_job,p_lease);if p_stage is distinct from j.stage or p_cursor is distinct from j.cursor then return jsonb_build_object('stage',j.stage,'cursor',j.cursor,'replayed',true);end if;
 if p_stage not between 0 and 4 or jsonb_typeof(p_rows)is distinct from 'array'or jsonb_array_length(p_rows)>100 or length(coalesce(p_after,''))>2000 or p_after is not null and p_after=p_cursor then raise exception 'Invalid provider page'using errcode='22023';end if;
 k=(array['campaign','adset','creative','ad'])[least(p_stage+1,4)];
 for r in select * from jsonb_array_elements(p_rows)loop
 if r->>'id'!~'^[0-9]+$'then raise exception 'Invalid Meta identity'using errcode='22023';end if;
 if p_stage=4 then
 if(r->>'date')::date<j.since or(r->>'date')::date>j.until or coalesce(r->>'spend','')!~'^[0-9]{1,14}\.[0-9]{6}$'then raise exception 'Invalid daily spend grain/date'using errcode='22023';end if;
 insert into crm_private.meta_daily(job_id,ad_id,day,campaign_id,adset_id,spend,lead_actions,actions)values(j.id,r->>'id',(r->>'date')::date,r->>'campaign_id',r->>'adset_id',(r->>'spend')::numeric,nullif(r->>'leads','')::numeric,coalesce(r->'actions','{}'))on conflict(job_id,ad_id,day)do update set campaign_id=excluded.campaign_id,adset_id=excluded.adset_id,spend=excluded.spend,lead_actions=excluded.lead_actions,actions=excluded.actions;
 else insert into crm_private.meta_entities(job_id,kind,external_id,data)values(j.id,k,r->>'id',r)on conflict(job_id,kind,external_id)do update set data=excluded.data;end if;
 end loop;
 update crm_private.meta_jobs set state='queued',lease=null,cursor=p_after,stage=case when p_after is null then stage+1 else stage end,lease_until=null,updated_at=now(),rows_processed=(select count(*)from crm_private.meta_entities where job_id=j.id)+(select count(*)from crm_private.meta_daily where job_id=j.id)where id=j.id returning * into j;
 return jsonb_build_object('stage',j.stage,'cursor',j.cursor,'rows_processed',j.rows_processed);
end$$;
create function public.crm_meta_retry(p_job uuid,p_lease uuid,p_code text,p_delay integer default 0)returns void language plpgsql security definer set search_path=''as $$declare j crm_private.meta_jobs;begin
 j=crm_private.meta_fence(p_job,p_lease);if p_code not in('reconnect','permission','rate_limit','temporary','invalid','worker_error')then raise exception 'Invalid safe error code'using errcode='22023';end if;
 if p_code in('reconnect','permission')then update crm_private.meta_connections set state='reconnect',updated_at=now()where organization_id=j.organization_id;update crm_private.meta_jobs set state='failed',error_code=p_code,lease=null,updated_at=now()where id=j.id;
 else update crm_private.meta_jobs set state=case when retries>=5 or p_code in('invalid','worker_error')then 'failed'else 'retry'end,retries=retries+1,error_code=p_code,next_attempt_at=now()+make_interval(secs=>least(900,greatest(coalesce(p_delay,0),15*power(2,least(retries,5))::integer))),lease=null,updated_at=now()where id=j.id;end if;
 if exists(select 1 from crm_private.meta_jobs where id=j.id and state='failed')then update crm_private.meta_accounts set next_due_at=now()+make_interval(mins=>interval_minutes)where organization_id=j.organization_id and id=j.account_id;end if;
end$$;
create function public.crm_meta_publish(p_job uuid,p_lease uuid)returns jsonb language plpgsql security definer set search_path=''as $$declare j crm_private.meta_jobs;e record;ref uuid;camp uuid;creative uuid;actor uuid;begin
 if exists(select 1 from crm_private.meta_jobs where id=p_job and state='completed')then return '{"replayed":true}';end if;j=crm_private.meta_fence(p_job,p_lease);if j.stage<>5 then raise exception 'All provider pages must finish first'using errcode='22023';end if;
 select connected_by into actor from crm_private.meta_connections where organization_id=j.organization_id;
 -- Parent references first. Metadata import happens only in this publication transaction.
 for e in select * from crm_private.meta_entities where job_id=j.id and kind in('campaign','creative')order by kind,external_id loop
 insert into public.ad_references(id,organization_id,kind,name,external_id,created_by,provider,provider_account,provider_external,provider_status,provider_synced_at,archived)values(gen_random_uuid(),j.organization_id,e.kind,left(e.data->>'name',100),e.external_id,actor,'meta',j.account_id,e.external_id,e.data->>'status',now(),coalesce(e.data->>'status','')in('DELETED','ARCHIVED'))on conflict(organization_id,provider,provider_account,kind,provider_external)where provider='meta'do update set name=excluded.name,archived=excluded.archived,provider_status=excluded.provider_status,provider_synced_at=now(),revision=ad_references.revision+1;
 end loop;
 for e in select * from crm_private.meta_entities where job_id=j.id and kind='ad'order by external_id loop
 select id into camp from public.ad_references where organization_id=j.organization_id and provider='meta'and provider_account=j.account_id and kind='campaign'and provider_external=e.data->>'campaign_id';
 select id into creative from public.ad_references where organization_id=j.organization_id and provider='meta'and provider_account=j.account_id and kind='creative'and provider_external=e.data->>'creative_id';
 insert into public.ad_references(id,organization_id,kind,name,external_id,creative_id,campaign_ref,created_by,provider,provider_account,provider_external,provider_status,provider_synced_at,archived)values(gen_random_uuid(),j.organization_id,'ad',left(e.data->>'name',100),e.external_id,creative,camp,actor,'meta',j.account_id,e.external_id,e.data->>'status',now(),coalesce(e.data->>'status','')in('DELETED','ARCHIVED'))on conflict(organization_id,provider,provider_account,kind,provider_external)where provider='meta'do update set name=excluded.name,creative_id=excluded.creative_id,campaign_ref=excluded.campaign_ref,archived=excluded.archived,provider_status=excluded.provider_status,provider_synced_at=now(),revision=ad_references.revision+1;
 end loop;
 update crm_private.meta_jobs set state='completed',lease=null,published_at=now(),updated_at=now(),error_code=null where id=j.id;
 update crm_private.meta_accounts set current_snapshot=j.id,last_success_at=now(),next_due_at=now()+make_interval(mins=>interval_minutes)where organization_id=j.organization_id and id=j.account_id;
 return jsonb_build_object('published',true,'snapshot',j.id);
end$$;
revoke all on function crm_private.meta_fence(uuid,uuid)from public,anon,authenticated,service_role;
revoke all on function public.crm_meta_claim(),public.crm_meta_page(uuid,uuid,integer,text,text,jsonb),public.crm_meta_retry(uuid,uuid,text,integer),public.crm_meta_publish(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.crm_meta_claim(),public.crm_meta_page(uuid,uuid,integer,text,text,jsonb),public.crm_meta_retry(uuid,uuid,text,integer),public.crm_meta_publish(uuid,uuid)to crm_meta_worker;
commit;
