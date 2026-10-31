# CRM working and delivery rules

## Scope and implementation

- Preserve existing accounts, passwords, leads, history, bootstrap protection and
  unrelated workspace work. Build only the explicitly authorized CRM step.
- Build each vertical slice with database migrations, backend authorization,
  frontend, and verification together. Do not start a subsequent step implicitly.
- Keep code/documentation in English and explain progress/results in simple Gujarati.
- Distinguish local checks, live integration verification and blocked/unverified work.

## Standing Git delivery requirement

Repository: https://github.com/yaminimeti6/CRM-software

After every completed step/task:

1. Inspect the existing repository, working branch, status and remotes. Never
   duplicate or reinitialize it. Review all related additions, modifications,
   deletions, new directories, migrations, tests, dependency lockfiles and docs.
2. Preserve unrelated changes. Never discard files, overwrite remote work or force
   push. Verify the remote URL matches the repository above before every push.
3. Keep `.gitignore` correct. Never commit local env files, private API keys,
   passwords, invitation/session tokens, credentials, node_modules or build output.
   `.env.example` must contain placeholders only. Scan staged files for secrets.
4. Run checks appropriate to the change before committing. Review the staged diff
   and commit all related files with a clear step/task-specific commit message.
5. Fetch/check the remote branch before pushing. Integrate new remote commits
   safely without overwriting history and rerun affected checks after integration.
6. Push to the current working branch. User authorization for this delivery flow
   persists; no repeat confirmation is needed for routine commit/push.
7. If authentication/permissions block pushing, report the actual error and do not
   claim upload success. Never request private credentials in ordinary chat.
8. Include branch, full commit hash, GitHub commit link and actual push status in
   the completion report. Verify the remote branch points to the pushed commit.
