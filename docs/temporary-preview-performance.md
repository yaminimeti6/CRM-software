# Temporary CRM preview: theme interactivity and loading

2026-11-12. The owner reported slow ngrok pages and nonfunctional themes. No account, password, record, API permission or calling rule was changed.

## Reproduced and repaired

The tunnel was attached to the development server on port 3000. An anonymous browser check reproduced a Dark button click leaving the theme Mixed, despite HTTP 200 and no reported failed static assets. A fresh optimized build was created in .cache/crm-preview-build, separate from the development cache. Only the identified workspace dev parent/child were stopped, then one next start process served the isolated build on the same port. The existing ngrok link and request-inspection setting were preserved.

The fresh preview restored theme interactivity. This is observed runtime evidence; the exact internal cause of the earlier dev hydration stall was not traced. It is not described as a proven bug in the theme-state hook.

## Browser evidence

- Anonymous localhost and ngrok: Light/Dark/Mixed click updates, actual card colors, reload persistence and navigation to the public invitation page passed. No JavaScript errors or failed Next assets.
- The verification run measured network-idle first load at 625 ms locally and 1134 ms through ngrok. These are sample login-page measurements, not an authenticated-page performance SLA.
- Anonymous API access remained HTTP 401. No staff cookies or customer records were forwarded through ngrok by the verifier.
- The owner manually confirmed that themes and speed were now satisfactory in their logged-in ngrok CRM. This is owner feedback, not an agent-authenticated public test.
- Existing authenticated All Leads regression passed only through localhost: frozen columns, three themes, six detail tabs, draft protection, intercepted uncertain retries/stale edits and real server filters. No new users/leads or actual call writes; public-record/password fingerprints matched.
- Optimized build/type checking and the 25-asset browser-secret scan passed. Targeted port/listener/agent ownership tests passed.

Ignored screenshots and measured evidence: .cache/tunnel-themes/.

## Repeatable operation

After stopping the current CRM process (or after restarting the PC):

```powershell
npm.cmd run preview:build
npm.cmd run preview
```

In a second terminal:

```powershell
node scripts/start-crm-tunnel.mjs
```

preview:build and preview use .cache/crm-preview-build. Stop the active preview before rebuilding the same folder. A foreground preview can be stopped with Ctrl+C; the tunnel has its existing targeted stop helper. No Windows startup service was installed.

The npm dev/start/preview launchers now check IPv4 and IPv6 occupancy before launching; they reject a duplicate instead of silently creating split instances. They do not kill unrelated processes. Explicit direct next commands outside these wrappers can bypass this operational preflight; use the prepared commands. The tunnel's existing build-parity preflight remains in place.

No permanent deployment or GitHub push. The PC, CRM server, internet and ngrok agent must remain running. Actual live /Wife/ to CRM/real Sheet acceptance and Meta consent/sync remain separate pending work.
