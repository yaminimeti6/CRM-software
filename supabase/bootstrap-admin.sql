-- Retired: use npm run setup:admin for durable one-time protection and recovery.
-- See docs/first-admin.md. Do not manually insert the first Admin.
do $$ begin raise exception 'Use the protected local setup:admin command.'; end $$;
