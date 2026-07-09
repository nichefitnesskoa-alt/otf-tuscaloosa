## Goal

On the MyDay **Planning to Buy** urgent banner, replace/augment the current buttons with a **"We texted them"** action that:

1. Logs the text and hides the person from the banner.
2. Brings them back to the banner **2 days later** if no outcome has been logged.
3. After the SA taps "We texted them" a **second time**, if 2 more days pass with no response/outcome, the system **auto-marks the intro Not Interested**.

## Behavior spec

- **First tap ("We texted them"):**
  - Insert a `followup_touches` row (channel=`sms`, note "Texted about planning-to-buy date").
  - Mark the current `follow_up_queue` row: `status='sent'`, `sent_at=now()`, `sent_by=user`.
  - Insert a **new** `follow_up_queue` row for the same booking: `person_type='planning_to_buy'`, `touch_number = prev + 1`, `scheduled_date = today + 2 days`, `status='pending'`, `closed_reason='awaiting_response_1'`. Banner re-surfaces automatically 2 days later (existing `scheduled_date <= today` query).

- **Second tap (when the re-surfaced row shows, touch_number ≥ 2):**
  - Same touch + mark-sent behavior.
  - Insert next queue row: `scheduled_date = today + 2 days`, `closed_reason='awaiting_response_final'`.

- **Auto Not Interested check (runs on banner mount):**
  - For any `follow_up_queue` row where `person_type='planning_to_buy'`, `status='pending'`, `scheduled_date <= today`, and `closed_reason='awaiting_response_final'`:
    - Confirm no new `followup_touches` or `intros_run` outcome for that booking since the row's `created_at`.
    - Call the canonical outcome pipeline `applyIntroOutcomeUpdate` to set the intro's `result_canon='NOT_INTERESTED'` (with `notes: 'Auto: no response after 2 follow-up texts'`, `performed_by: 'System (planning-to-buy auto-close)'`).
    - Update the queue row: `status='converted'`, `not_interested_at=now()`, `not_interested_by='System'`, `closed_reason='auto_not_interested'`.
  - Because `applyIntroOutcomeUpdate` writes `intros_run.result_canon='NOT_INTERESTED'`, the existing `soml_resolve_pending_referral` trigger also flips any pending SOML referral to `not_converted` — coherent across WIG/SOML/Follow-Up.

- **Anything that logs an actual outcome (Log button, buy_date update, purchase, not-interested from another surface) already closes the follow-up chain** because `useFollowUpData` / SOML triggers respect `result_canon`, and the banner's `isTerminal` check filters those bookings out. No extra work needed.

## UI changes (banner only)

`src/features/myDay/PlanningToBuyUrgent.tsx`
- Replace the current "Text" (SMS) + "Log" buttons with three side-by-side buttons matching existing sizing / OTF-orange primary rules:
  - **Text** (unchanged `sms:` link, still opens SMS — separate from logging, per user).
  - **We texted them** (primary orange, calls the new handler above; shows `Saved` inline 2s).
  - **Log outcome** (secondary, existing dispatch to `myday:open-outcome`).
- Add a small subtitle line on rows that are on their second attempt: "2nd try — auto marks Not Interested in 2 days if no response" (destructive text, `text-[10px]`).
- Realtime channel already listens to `follow_up_queue` + `intros_run`, so re-surfacing after 2 days and disappearance on outcome are automatic.

## Data / logic touch points

- **No schema changes.** Uses existing `follow_up_queue` columns (`touch_number`, `closed_reason`, `status`, `not_interested_at`, `not_interested_by`, `scheduled_date`).
- **Canonical helper reused:** `applyIntroOutcomeUpdate` from `src/lib/domain/outcomes` — do NOT reimplement the not-interested write inline.
- **No changes** to Follow-Up page logic — planning_to_buy already flows through `useFollowUpData` and will keep working; the auto-close simply writes the canonical outcome, which every downstream reader already respects.

## Cross-page reach check (must all agree after this ships)

- **MyDay banner** — person disappears on first tap, reappears at day+2, auto-closes at day+4.
- **Follow-Up page (`useFollowUpData`)** — planning_to_buy row disappears once queue row hits `status='converted'` or intro gets `NOT_INTERESTED`.
- **SOML pending referrals** — trigger `soml_resolve_pending_referral` flips to `not_converted` when the auto-close writes `NOT_INTERESTED`.
- **WIG / commission** — unchanged; not-interested is not a sale.

## Files touched

- `src/features/myDay/PlanningToBuyUrgent.tsx` — button set, handlers, auto-close-on-mount effect.
- (Optional, only if the auto-close helper grows) new `src/features/myDay/planningToBuyAutoClose.ts` for the auto-close routine so the component stays lean.

## Not doing

- No new DB tables, no new cron, no scheduled edge function — auto-close runs on any MyDay mount / realtime tick, which is sufficient for a studio-hours app.
- No changes to the Follow-Up page UI or to `useFollowUpData` cadence.
