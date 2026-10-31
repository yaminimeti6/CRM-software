-- Retired for normal onboarding: use Admin Team invitations.
-- The recipient must verify ownership and choose their own password.
-- See docs/team-management.md. Existing staff/data are unchanged.
do $$ begin raise exception 'Use Team invitations; do not bypass verified account ownership with manual inserts.'; end $$;
