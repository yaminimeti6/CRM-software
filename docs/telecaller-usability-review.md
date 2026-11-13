# Telecaller workflow usability review

Scope: local browser walkthrough of the existing main CRM using an existing active Telecaller account and the retained demonstration inquiry. This is an operator walkthrough and automated interaction check, not independent human usability acceptance.

## Findings and fixes

| Finding | Change |
| --- | --- |
| Adding next-call details made the explicit Record call button fall below the panel viewport. | Keep the save action sticky within the call form, above the panel footer, on desktop and mobile. |
| Successful saving left a disabled button labelled Retry saving. | Show Call recorded after success; retries remain available only for uncertain submissions. The next deliberate attempt is labelled Record another call. |
| On narrow screens the frozen Name/Mobile cells obscured the far-right call action. | Add a mobile-only Record call button in the frozen Name cell. Preserve the original desktop action and frozen columns. |

## Staff journey

1. Find the lead in All Leads. Click its name to read the order, course/price, submitted answers and recent activity.
2. Call using your phone. Opening a lead or call panel does not place or count a call.
3. Choose Record call. On mobile this action is also available below the lead name.
4. Deliberately select the result, add optional notes, and select Call again later if a next-call date is needed. Enter the date/time in IST.
5. Record call once after a real attempt. If saving is uncertain, Retry saving preserves the same request. After success, Call recorded is disabled; close the panel to return to the list. Today's follow-ups opens the existing due-today queue.

## Verification boundary

Command: `node scripts/verify-telecaller-usability.mjs` against `http://localhost:3000`.

The walkthrough checks order/details navigation, the direct call action, mandatory deliberate result selection, call notes and follow-up draft across tabs, visible desktop/mobile save controls, identical uncertain retries, history refresh, close guard, simulated success feedback, return to the same lead list, actual New-lead filtering and due-today navigation. It checks three themes and 390px mobile layout.

All business mutations are intercepted. The successful call/follow-up response is simulated in the browser; it is not a persisted call or follow-up. Public-table and account/password fingerprints are compared before/after. No new lead, user or synthetic business record is created. Existing call APIs, counters, permissions, Admin and Invite Staff are unchanged.

Private local evidence and screenshots: `.cache/telecaller-usability/`. Build/TypeScript and the 58-test suite are checked separately. The current workspace contains unrelated edits, which are preserved and excluded from this task commit.

Independent staff feedback and a real authorized call remain separate acceptance activities. Live website capture and real Sheet acceptance remain pending. No push or deployment is authorized by this review.

## Subsequent user-eye corrections

The earlier sticky-save approach was superseded: making a button visible was insufficient because it covered the date field. Save now follows the fields in normal flow. Mobile checks scroll to the date and verify its centre actually receives pointer input, then scroll to the save action separately.

- **Open call form** opens the editor and performs no business write. **Save call result** explicitly records the attempt. Success still shows Call recorded; uncertain retries retain the original request.
- A visible note beside the table states that changing Status does not record a call. Status help explains known category effects and that Retry does not automatically schedule a follow-up.
- Neither the owner nor existing code/documentation defined CNP. Its help explicitly says the meaning is undefined and asks staff to check with their team. No expansion was invented; all stored status names, IDs, categories and history are unchanged.
- Customer answers are shown first. Known order/advertising fields are available under **Order & tracking fields**. Unknown dynamic questions stay in the customer section. Structured values render as labelled values and Yes/No rather than raw JSON; original values remain available in collapsed advanced details and are never rewritten.
- Unit checks cover metadata grouping without field loss, literal IDs, nested values, unknown questions, special object keys, unchanged originals and honest status explanations. Existing browser verifiers were updated for the distinct action labels.

This changes presentation only. Existing backend authorization, counters, records, Admin and Invite Staff remain intact. The unrelated workspace edits are excluded from the task commit.

Verification: optimized build/TypeScript and 60 tests passed. The existing Telecaller browser walkthrough passed with grouped-answer checks, distinct open/save actions, simulated save feedback, identical retries and a pointer hit-test confirming that the mobile date input is not covered. Advanced All Leads regression also passed, including first-row visibility at 1600x780, frozen Name/Mobile, six tabs, actual server filters and intercepted stale edit/call/follow-up retries. Database and password fingerprints remained unchanged. No actual call or follow-up was recorded.
