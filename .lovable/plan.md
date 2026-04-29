## Goal
VIP class attendees the coach actually saw (`outcome = showed` or `booked_intro`) should appear on the coach's **My Intros** list as follow-up cards. VIP no-shows are an SA reschedule task and should NOT show on the coach side — they go to the SA follow-up queue instead.

## Scope
- File: `src/pages/CoachMyIntros.tsx`
- File: `src/components/vip/` outcome logging path (where `vip_registrations.outcome` is saved — `VipRegistrationsSheet.tsx` `saveOutcome`) — add a side-effect to enqueue an SA reschedule task on `no_show`.
- No schema changes. Reuse existing tables: `vip_registrations`, `vip_sessions`, `follow_up_queue`.

## 1. Coach My Intros — pull in VIP attendees

In `fetchData`:
1. Query `vip_sessions` where `coach_name = coachName` to get session ids the coach ran.
2. Query `vip_registrations` for those `vip_session_id`s where:
   - `outcome IN ('showed', 'booked_intro')`
   - `is_group_contact = false`
   - `booking_id IS NULL` (if `booking_id` is set, a real intro already exists and will appear via the normal bookings query — skip to avoid the duplicate the user already complained about).
3. Map each VIP reg into a synthetic `MergedIntro`:
   - `bookingId`: prefix `vip:` + `vip_registrations.id` so it's unique and never collides with real bookings.
   - `memberName`: `first_name + last_name`.
   - `classDate`: `vip_sessions.session_date`.
   - `introTime`: `vip_sessions.session_time`.
   - `phone`: `vip_registrations.phone`.
   - `resultCanon`:
     - `outcome = 'booked_intro'` → `'SECOND_INTRO'` (uses existing teal "2nd Intro Planned" badge — semantically: they took the next step).
     - `outcome = 'showed'` → `'DIDNT_BUY'` (orange "Follow-Up" badge — needs a touch).
   - `rescheduleContactDate`: null (uses 48-hr post-class priority window from `class_start_at` we synthesize from session date+time).
   - `lastTouch`, `questionnaire`, `saConversation`, `followUpRow`: null.
   - `transferred`: false.
4. Run the existing **Total Journey** sale check against these too (by normalized member name match against `soldNames`) so anyone who later bought drops off automatically.
5. Push into `merged` BEFORE the dedup pass. Dedup is already by lowercased member name, so if the same person also has a real intro booking the real one wins (it sorted first by priority/date) and the VIP duplicate is dropped — same rule the user asked for: one card per person.

## 2. Card behavior for VIP entries
- The existing card UI works as-is because everything keys off `MergedIntro`.
- Hide the "Log Sent" / "Mark Not Interested" buttons that write to `follow_up_queue` for synthetic VIP rows (no `follow_up_queue` row exists). Replace with a single **"Convert to Intro"** action that opens the existing `ConvertVipToIntroDialog` (already in the codebase). After conversion the synthetic card disappears next refresh because `booking_id` is now set on the registration.
- "Copy phone" and "Send Script" buttons still work (they only need name + phone).

## 3. VIP no-shows → SA reschedule task

In `VipRegistrationsSheet.tsx` `saveOutcome`, when `outcome === 'no_show'`:
- Insert a `follow_up_queue` row:
  - `person_name`: full name
  - `person_type`: `'vip_no_show'`
  - `owner_role`: `'SA'`
  - `coach_owner`: null
  - `scheduled_date` / `trigger_date`: today
  - `touch_number`: 1
  - `status`: `'pending'`
  - `is_vip`: true
  - `closed_reason`: null
  - Store `vip_session_id` and `vip_registration_id` in the existing free-text columns we have (or skip linkage — the SA just needs the name + phone + "VIP no-show, try to reschedule" context). Use `fitness_goal` field as a short note: `"VIP no-show — reschedule into intro"` so it surfaces on the existing SA follow-up card.
- Toast: "Logged no-show — sent to SA reschedule queue".
- Idempotent: check before insert that no `follow_up_queue` row already exists with the same `person_name` + same day + `person_type = 'vip_no_show'`.

## Downstream effects
- Coach My Intros: now shows VIP showed/booked-intro attendees alongside real intros. Dedup still guarantees one card per person.
- SA Follow-Up page (`useFollowUpData`): VIP no-shows surface as standard SA follow-ups (it already reads `follow_up_queue` where `owner_role = 'SA'`). No code change needed there — the row inserted in step 3 will just appear.
- VIP Registrations sheet: behavior is additive. Existing `booked_intro` flow that opens `BookIntroSheet` still runs.
- Sales drop-off: Total Journey sale matching extended to VIP rows so a member who bought after the VIP class is auto-removed from the coach list (matches existing rule).
- No tables changed. No new RLS. No new triggers.

## Done means
- Coach sees VIP attendees they coached on My Intros, with correct status badges, sorted with their normal intros by priority.
- VIP no-shows do NOT appear on the coach side.
- VIP no-shows DO appear on the SA Follow-Up page as a reschedule task.
- One card per person — no duplicates between real intros and VIP rows.
- Logging a VIP outcome does not break the existing "Booked intro" → BookIntroSheet flow.
