begin;
-- Supabase supplies pg_cron. Embedded/local databases without it retain the
-- authenticated access cleanup and service-only operator cleanup command.
do $$begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  execute 'create extension if not exists pg_cron with schema pg_catalog';
  perform cron.schedule('crm-import-retention','* * * * *','select crm_private.expire_import_files(null);');
 end if;
end$$;
commit;
