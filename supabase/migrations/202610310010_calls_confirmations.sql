begin;
alter table public.lead_statuses add column category text not null default 'other' check(category in ('new','other','confirmed','cancelled'));
update public.lead_statuses set category='new' where is_new;
alter table public.lead_statuses drop constraint lead_statuses_label_check;
alter table public.lead_statuses add constraint lead_status_label_valid check(length(trim(label)) between 1 and 80 and (category='confirmed' or lower(label) not like '%confirm%'));
alter table public.lead_statuses add constraint lead_status_new_category check((is_new and category='new') or (not is_new and category<>'new'));
create unique index lead_status_one_confirmed on public.lead_statuses(organization_id) where category='confirmed';
insert into public.lead_statuses(organization_id,label,category,sort_order)
 select o.id,s.label,s.category,s.position from public.organizations o cross join(values('CNP','other',20),('Confirm','confirmed',30),('Cancel','cancelled',40)) s(label,category,position)
 on conflict(organization_id,label) do nothing;
create or replace function crm_private.seed_lead_statuses() returns trigger language plpgsql set search_path='' as $$
begin
 insert into public.lead_statuses(organization_id,label,is_new,category,sort_order) values
 (NEW.id,'New',true,'new',0),(NEW.id,'Retry',false,'other',10),(NEW.id,'CNP',false,'other',20),(NEW.id,'Confirm',false,'confirmed',30),(NEW.id,'Cancel',false,'cancelled',40);
 return NEW;
end $$;
alter table public.leads add column first_confirmed_at timestamptz,add column first_confirmed_by uuid references auth.users(id),
 add column latest_confirmed_at timestamptz,add column latest_confirmed_by uuid references auth.users(id);
alter table public.lead_edit_history add column activity_type text check(activity_type in ('created','edit','call'));

create table public.call_attempts (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,lead_id uuid not null,
 caller_id uuid not null references auth.users(id),request_id uuid not null,
 attempted_at timestamptz not null default clock_timestamp(),previous_status_id uuid not null,outcome_status_id uuid not null,
 outcome_label text not null,reason text not null default '' check(length(reason)<=500),notes text not null default '' check(length(notes)<=4000),
 lead_version integer not null,request_payload jsonb not null,
 foreign key(organization_id,lead_id) references public.leads(organization_id,id) on delete cascade,
 foreign key(organization_id,previous_status_id) references public.lead_statuses(organization_id,id),
 foreign key(organization_id,outcome_status_id) references public.lead_statuses(organization_id,id),
 unique(organization_id,caller_id,request_id),unique(lead_id,lead_version)
);
create index call_attempts_lead_time on public.call_attempts(organization_id,lead_id,attempted_at desc,id desc);
create table public.confirmation_events (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,lead_id uuid not null,
 confirmed_by uuid not null references auth.users(id),confirmed_at timestamptz not null default clock_timestamp(),
 lead_version integer not null,call_attempt_id uuid references public.call_attempts(id) on delete cascade,
 source text not null check(source in ('call','inline')),
 foreign key(organization_id,lead_id) references public.leads(organization_id,id) on delete cascade,
 unique(lead_id,lead_version)
);
create index confirmation_events_lead_time on public.confirmation_events(organization_id,lead_id,confirmed_at desc);
alter table public.call_attempts enable row level security;
alter table public.confirmation_events enable row level security;
revoke all on public.call_attempts,public.confirmation_events from public,anon,authenticated;
grant select on public.call_attempts,public.confirmation_events to authenticated;
create policy calls_read_organization on public.call_attempts for select to authenticated using(organization_id=(select public.lead_organization()));
create policy confirmations_read_organization on public.confirmation_events for select to authenticated using(organization_id=(select public.lead_organization()));

-- Every permitted update, whether inline or Log Call, uses this one transition
-- trigger. Protected attribution is never supplied by an ordinary caller.
create function crm_private.track_confirmation() returns trigger language plpgsql set search_path='' as $$
declare previous_category text;next_category text;attempt uuid;moment timestamptz;
begin
 NEW.first_confirmed_at=OLD.first_confirmed_at;NEW.first_confirmed_by=OLD.first_confirmed_by;
 NEW.latest_confirmed_at=OLD.latest_confirmed_at;NEW.latest_confirmed_by=OLD.latest_confirmed_by;
 select category into previous_category from public.lead_statuses where id=OLD.status_id and organization_id=OLD.organization_id;
 select category into next_category from public.lead_statuses where id=NEW.status_id and organization_id=NEW.organization_id;
 if next_category='confirmed' and previous_category<>'confirmed' then
  moment=clock_timestamp();
  select id into attempt from public.call_attempts where organization_id=NEW.organization_id and lead_id=NEW.id and lead_version=NEW.version;
  insert into public.confirmation_events(organization_id,lead_id,confirmed_by,confirmed_at,lead_version,call_attempt_id,source)
   values(NEW.organization_id,NEW.id,auth.uid(),moment,NEW.version,attempt,case when attempt is null then 'inline' else 'call' end);
  NEW.first_confirmed_at=coalesce(OLD.first_confirmed_at,moment);NEW.first_confirmed_by=coalesce(OLD.first_confirmed_by,auth.uid());
  NEW.latest_confirmed_at=moment;NEW.latest_confirmed_by=auth.uid();
 end if;
 return NEW;
end $$;
revoke all on function crm_private.track_confirmation() from public,anon,authenticated;
create trigger lead_confirmation_transition before update on public.leads for each row execute function crm_private.track_confirmation();

create or replace function crm_private.record_lead_edit() returns trigger language plpgsql set search_path='' as $$
declare delta jsonb;previous jsonb;kind text;
begin
 if TG_OP='INSERT' then previous='{}';kind='created';else
  previous=to_jsonb(OLD);kind=case when exists(select 1 from public.call_attempts where lead_id=NEW.id and organization_id=NEW.organization_id and lead_version=NEW.version) then 'call' else 'edit' end;
 end if;
 select coalesce(jsonb_object_agg(k,jsonb_build_object('before',previous->k,'after',to_jsonb(NEW)->k)),'{}') into delta
  from unnest(array['name','mobile_no','address','notes','answers','status_id']) k where (previous->k) is distinct from (to_jsonb(NEW)->k);
 insert into public.lead_edit_history(organization_id,lead_id,editor_id,version,changes,activity_type) values(NEW.organization_id,NEW.id,auth.uid(),NEW.version,delta,kind);
 insert into public.lead_field_definitions(organization_id,field_key) select NEW.organization_id,key from jsonb_object_keys(NEW.answers) key on conflict do nothing;
 return NEW;
end $$;

create function public.log_lead_call(p_id uuid,p_version integer,p_request uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare org uuid;actor uuid;current_lead public.leads;outcome public.lead_statuses;existing public.call_attempts;
 attempt public.call_attempts;payload jsonb;reason_text text;notes_text text;
begin
 org=public.lead_organization();actor=auth.uid();
 if org is null then raise exception 'Operational staff required' using errcode='42501';end if;
 if p_request is null or p_version is null or p_version<1 or jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Invalid call details' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(p_input) k where k not in ('status_id','reason','notes'))
  or jsonb_typeof(p_input->'status_id') is distinct from 'string'
  or (p_input?'reason' and jsonb_typeof(p_input->'reason')<>'string') or (p_input?'notes' and jsonb_typeof(p_input->'notes')<>'string') then raise exception 'Protected or invalid call fields' using errcode='22023';end if;
 reason_text=coalesce(p_input->>'reason','');notes_text=coalesce(p_input->>'notes','');
 if length(reason_text)>500 or length(notes_text)>4000 then raise exception 'Call text too long' using errcode='22023';end if;
 payload=jsonb_build_object('lead_id',p_id,'version',p_version,'status_id',(p_input->>'status_id')::uuid,'reason',reason_text,'notes',notes_text);
 -- Request lock precedes the lead lock. Retries return the original committed
 -- attempt even after another caller subsequently updates this lead.
 perform pg_advisory_xact_lock(hashtextextended(org::text||actor::text||p_request::text,0));
 select * into existing from public.call_attempts where organization_id=org and caller_id=actor and request_id=p_request;
 if found then
  if existing.request_payload<>payload then raise exception 'Request key already used with different details' using errcode='PT409';end if;
  return jsonb_build_object('attempt_id',existing.id,'version',existing.lead_version,'replayed',true);
 end if;
 select * into current_lead from public.leads where id=p_id and organization_id=org for update;
 if not found then raise exception 'Lead unavailable' using errcode='42501';end if;
 if current_lead.version<>p_version then raise exception 'Lead changed. Reload and review before logging this call.' using errcode='PT409';end if;
 select * into outcome from public.lead_statuses where id=(p_input->>'status_id')::uuid and organization_id=org and active;
 if not found then raise exception 'Outcome unavailable' using errcode='22023';end if;
 insert into public.call_attempts(organization_id,lead_id,caller_id,request_id,previous_status_id,outcome_status_id,outcome_label,reason,notes,lead_version,request_payload)
 values(org,p_id,actor,p_request,current_lead.status_id,outcome.id,outcome.label,reason_text,notes_text,current_lead.version+1,payload) returning * into attempt;
 update public.leads set status_id=outcome.id,version=version+1,updated_at=clock_timestamp() where id=p_id and organization_id=org;
 return jsonb_build_object('attempt_id',attempt.id,'version',attempt.lead_version,'replayed',false);
end $$;
revoke all on function public.log_lead_call(uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.log_lead_call(uuid,integer,uuid,jsonb) to authenticated;

create function public.lead_call_details(p_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare org uuid;lead public.leads;current_category text;
begin
 org=public.lead_organization();
 if org is null then raise exception 'Operational staff required' using errcode='42501';end if;
 if p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid page' using errcode='22023';end if;
 select * into lead from public.leads where id=p_id and organization_id=org;
 if not found then raise exception 'Lead unavailable' using errcode='42501';end if;
 select category into current_category from public.lead_statuses where id=lead.status_id and organization_id=org;
 return jsonb_build_object('version',lead.version,'status_id',lead.status_id,
  'attempt_count',(select count(*) from public.call_attempts where lead_id=p_id and organization_id=org),
  'confirmation_event_count',(select count(*) from public.confirmation_events where lead_id=p_id and organization_id=org),
  'distinct_confirmed_leads',case when lead.first_confirmed_at is null then 0 else 1 end,'currently_confirmed',current_category='confirmed',
  'first_confirmed_at',lead.first_confirmed_at,'latest_confirmed_at',lead.latest_confirmed_at,
  'first_confirmed_by',coalesce((select p.full_name from public.staff_profiles p join public.organization_memberships m on m.user_id=p.id where p.id=lead.first_confirmed_by and m.organization_id=org),'Unavailable staff member'),
  'latest_confirmed_by',coalesce((select p.full_name from public.staff_profiles p join public.organization_memberships m on m.user_id=p.id where p.id=lead.latest_confirmed_by and m.organization_id=org),'Unavailable staff member'),
  'calls',coalesce((select jsonb_agg(to_jsonb(c)) from (select a.id,a.attempted_at,a.outcome_label,a.reason,a.notes,coalesce(p.full_name,'Unavailable staff member') caller
    from public.call_attempts a left join public.organization_memberships m on m.user_id=a.caller_id and m.organization_id=org left join public.staff_profiles p on p.id=m.user_id
    where a.lead_id=p_id and a.organization_id=org order by a.attempted_at desc,a.id desc limit 20 offset (p_page-1)*20)c),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e)) from (select c.confirmed_at,c.source,coalesce(p.full_name,'Unavailable staff member') caller
    from public.confirmation_events c left join public.organization_memberships m on m.user_id=c.confirmed_by and m.organization_id=org left join public.staff_profiles p on p.id=m.user_id
    where c.lead_id=p_id and c.organization_id=org order by c.confirmed_at desc,c.id desc limit 20 offset (p_page-1)*20)e),'[]'::jsonb));
end $$;
revoke all on function public.lead_call_details(uuid,integer) from public,anon;
grant execute on function public.lead_call_details(uuid,integer) to authenticated;
commit;
