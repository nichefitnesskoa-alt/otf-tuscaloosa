## Goal
Every lead-source edit surface, anywhere in the app, must (a) offer the "referring member name" field the moment a referral/"(Friend)" source is picked, and (b) trigger the same SOML/referral attribution as if that source had been set at booking time — even when the edit happens days later. Right now this only works in three places (BookIntroDialog, EditBookingDialog, PersonJourneyCard) and the DB trigger only fires when `lead_source`/`referred_by_member_name` actually change on `intros_booked`.

## Reach map — lead-source edit surfaces
Surfaces that let a user change `lead_source` on an existing booking (need the referrer field + referral write-through):

1. `src/features/pipeline/components/PipelineSpreadsheet.tsx` (line ~743) — inline Select, writes `lead_source` directly via `supabase.from('intros_booked').update(...)`. No referrer prompt.
2. `src/components/admin/ClientJourneyPanel.tsx` (line ~2272) — "Edit Booking" dialog. No referrer prompt.
3. `src/components/admin/ClientJourneyPanel.tsx` (line ~2392) — "Edit Run" dialog. Writes `lead_source` on `intros_run`, plus a paired `intros_booked` update on save. No referrer prompt.
4. `src/components/RescheduleClientDialog.tsx` — carries `lead_source` into a new booking. No referrer prompt for friend sources.
5. `src/components/admin/EditSaleDialog.tsx` — edits `lead_source` on `sales_outside_intro` and on linked `intros_booked`. No referrer prompt.
6. `src/features/pipeline/pipelineActions.ts` `updateBookingFieldsFromPipeline` — helper already accepts `referredByMemberName`; callers from Pipeline drilldowns need to pass it.
7. Any other drilldown that shows lead source (WIG SomlSection, Recaps, ShiftRecap, UnresolvedIntros, dashboard sheets) — currently read-only for lead source; leave as-is unless they expose an edit control.

## Fix strategy

### 1. Single shared control: `<LeadSourceWithReferrerField />`
Create `src/components/shared/LeadSourceWithReferrerField.tsx`:
- Props: `value`, `referredByMemberName`, `onChange({ lead_source, referred_by_member_name })`, `required`, `layout` (`stacked` | `inline`).
- Renders the canonical lead-source Select (imported from the existing options list, so *all* "(Friend)" variants are present — fixes the earlier "not all friend sources listed" concern in these surfaces).
- When `isReferralLikeSource(value)` is true, renders a required text input for the referring member's name.
- Clears the referrer when the user switches back to a non-referral source.
- Exports a `validateLeadSourceReferrer(value, referrer)` helper that every save handler calls before submit.

Replace the inline Selects + ad-hoc friend logic in:
- PipelineSpreadsheet inline editor (row 743) — swap to a small Popover that renders this control so the change + referrer commit together.
- ClientJourneyPanel edit-booking dialog (2272) and edit-run dialog (2392).
- RescheduleClientDialog.
- EditSaleDialog (only when editing the linked booking's lead source).
- EditBookingDialog, PersonJourneyCard, BookIntroDialog, SelfSourcedLeadForm — migrate to the shared control so future changes stay in one file.

### 2. Save-path write-through
Every save handler for the surfaces above must persist BOTH `lead_source` and `referred_by_member_name` in a single `update` (or clear the referrer when the new source isn't referral-like). Route them through `updateBookingFieldsFromPipeline` (or a new `updateBookingLeadSource` helper for non-pipeline surfaces) so a single function owns the referral write.

### 3. Make edits behave "as if true from the start" — DB layer
The `soml_create_pending_referral` trigger was already made UPDATE-aware last turn, but only for `intros_booked`. Extend coverage:

a. **Edits on `intros_run.lead_source`** — when a run row's lead source is changed to a referral/friend variant, propagate the change onto its `linked_intro_booked_id` booking (source of truth), which fires the existing trigger. Add a `trg_intros_run_propagate_referral_to_booking` BEFORE UPDATE trigger that, when `lead_source` or `referred_by_member_name` changes on a run, syncs those two fields onto the linked booking (only when the booking's values are stale or empty). This gives us one funnel — the booking trigger handles pending-referral creation.

b. **Retro-fix already-linked runs**: convert the linked booking's row to `soml_pending_referrals` immediately when a resolved run exists (i.e., the intro already ran or already has a sale). The existing `soml_resolve_pending_referral` trigger will then advance it to `realized`/`not_converted` on the next run touch. Add a one-shot: after inserting the pending row from the booking trigger, if a linked run already has a sale/no-interest result, call the resolve function inline so the state jumps straight to the correct terminal state without waiting for another edit.

c. **Backfill data migration**: run the same UPDATE-touch backfill we did before, but now include (i) bookings whose lead source was edited to a friend variant since last backfill, and (ii) bookings whose linked run carries a referral source that the booking doesn't. Idempotent because of `v_existing` guard.

d. Keep `enforce_member_referral_has_referrer` trigger — it already blocks bad edits system-wide.

### 4. Coherence proof (must produce before closing)
- Pick a booking currently with a non-referral source, edit it via PipelineSpreadsheet to "Online Intro Offer (Friend)" + referrer "TestMember" → verify `soml_pending_referrals` row appears with correct `credited_sa` and `referring_member`.
- Repeat via ClientJourneyPanel edit-booking dialog and edit-run dialog.
- Pick a booking whose linked run already has `result_canon='SALE'`, flip source to a friend variant → verify pending row is created AND resolved to `realized` in the same transaction chain.
- Query `soml_pending_referrals` counts before/after to confirm no duplicates on repeat edits.
- Cross-page: WIG SomlSection referral count = raw `soml_pending_referrals` count for the period.

## Technical touch list
- New: `src/components/shared/LeadSourceWithReferrerField.tsx`
- New: `src/lib/leads/updateBookingLeadSource.ts` (thin wrapper reused by non-pipeline surfaces)
- Edited: PipelineSpreadsheet.tsx, ClientJourneyPanel.tsx (2 dialogs), RescheduleClientDialog.tsx, EditSaleDialog.tsx, EditBookingDialog.tsx, PersonJourneyCard.tsx, BookIntroDialog.tsx, SelfSourcedLeadForm.tsx, pipelineActions.ts
- Migration: extend `soml_create_pending_referral` for inline resolve; add `trg_intros_run_propagate_referral_to_booking`; run backfill UPDATE over `intros_booked` where source is referral-like and no pending row exists; also touch bookings whose linked run's source disagrees.

## Out of scope (confirm)
- Adding inline lead-source editing to surfaces that don't currently expose it (read-only drilldowns like UnresolvedIntros, Recaps line items). The user said "any editable field should be editable on the spot" — I'm reading that as "every place that already lets me edit lead source should also let me set the referrer," not "add new edit controls to every read-only card." If you want me to also add inline lead-source editing to those read-only surfaces, say so and I'll expand scope.
