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

Effective from Step 8 onward (user instruction, 2026-11-03):

1. Inspect the existing repository, branch, status and remotes. Preserve all
   existing and unrelated work; never reinitialize, discard changes or force-push.
2. After the relevant checks pass, review and keep completed work in clear,
   step/task-specific local commits. Do not push after each step.
3. Keep secrets, local environment files, credentials, private import/customer
   files, node_modules and build artifacts out of commits. Keep .gitignore correct
   and scan the exact staged files for secrets before committing.
4. Push to GitHub only when the user explicitly asks at the end of the project.
   Earlier standing permission to push routinely is revoked. Do not infer push
   authorization from a request to implement or finish a step.
5. Before an explicitly authorized future push, verify the remote URL above,
   fetch/check the remote branch, safely integrate any new remote work and rerun
   affected checks. Push without rewriting remote history.
6. Report the current branch, full local commit hash and actual push status after
   each completed task. For unpushed commits, clearly say local only; do not claim
   a GitHub commit link is available. After an authorized push, report its actual
   result, commit link and verified remote hash. Never request secrets in chat.











