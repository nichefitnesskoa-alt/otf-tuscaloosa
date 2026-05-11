**Confirm option 1 for the roster.** Sales-based is right. "Members never asked" should mean actual members, not just people who appear in past ask history.

**Standard 4 label.** The spec calls it "Standard 4" internally but the standard sentence on screen should read: "Every member interaction counts." Make sure that's the displayed header, not a generic label.

**End-of-shift submit gate.** The spec says disabled until all three answers are non-empty. Loosen this — disabled until at least one answer is non-empty. The questions are optional fields. The act of submitting is what closes the shift. Don't block someone from closing because they didn't write in all three boxes.

Everything else — the two-table separation, the shift-type lanes staying independent, the referral guard rail, the realtime subscriptions, the export additions — is clean. Lock it and build.  
  
Shift View Restructure — Standards, Reflection, Referrals

## CONFIRM THIS VALUE — answered

Shift completions today live in **two tables**:

- `shift_task_completions` — per-task rows keyed `(sa_name, shift_date, shift_type, task_template_id|override_id)` with `completed`, `count_logged`. This stays — it's the right shape for the 5-standards checkboxes and counters.
- `shift_recaps` — per-shift recap (`staff_name, shift_date, shift_type` unique) with `calls_made / texts_sent / dms_sent / submitted_at` plus a bunch of legacy free-text fields. Constrained to `'AM Shift' | 'Mid Shift' | 'PM Shift'`. ShiftView uses lowercase `'morning' | 'mid' | 'last' | 'weekend'` — the two surfaces never meet today, which is part of the cleanup.

Decision: extend `shift_task_completions` for the per-task data (already correct). Add a **new** `shift_submissions` table for the three end-of-shift answers. Use a **new** `referral_asks` table — `referrals` is for booking-linked friend referrals (different concept), don't conflate.

## Schema

**New table `shift_submissions**` — one row per (sa_name, shift_date, shift_type)

- `id`, `sa_name`, `shift_date` (default today CST), `shift_type` (lowercase canon)
- `lead_forward_answer` text, `member_experience_answer` text, `ownership_lane_answer` text
- `submitted_at` timestamptz (null until close)
- `created_at`, `updated_at`
- UNIQUE (sa_name, shift_date, shift_type)
- RLS: same permissive pattern as siblings

**New table `referral_asks**`

- `id`, `sa_name`, `member_name` text not null, `friend_name` text, `asked_at` timestamptz default now(), `shift_date` date, `shift_type` text, `created_at`
- INDEX on `lower(member_name)` for the autocomplete guard rail
- RLS: same permissive pattern

`**shift_task_templates` cleanup (data, not schema)**

- Reseed templates so all four shifts (`morning`/`mid`/`last`/`weekend`) share the **same 5 standards** with the exact embedded checkboxes from the prompt. Soft-disable any tasks not in the new spec by setting `is_active = false`.
- Set `count_target = NULL` on every remaining template (no targets displayed). The DB column stays; the UI just won't render the `/ N`.

## UI rebuild — `src/features/shiftView/`

### `ShiftViewPage.tsx`

Add a **sticky header card** below the existing top bar containing:

1. The three questions, each with a one-line muted label and a read-only preview of the current draft answer (or "—" if blank). Tap opens the inline editor (or scrolls to the End-of-Shift card).
2. Inline disclaimer: *"Log the real number. We can work with honest. We can't work with hidden."*

The header stays in the document flow but uses `sticky top-[56px]` so it pins under the existing route header.

### `ShiftTaskList.tsx` — restructure

- Group tasks by **standard**. Render 5 collapsible standard cards (default expanded), each titled with the standard sentence, containing its embedded checkboxes/counters.
- A standard's task rows render exactly as today (checkbox + name + optional counter), so existing `shift_task_completions` reads/writes are untouched.
- Standard 4's "Ask a member if they have a friend…" task is a custom row (not a plain template task) — see Referral row below.
- **Drop** the `/ N` target rendering and `targetHit` green border. Counters show only the number + label.
- Group definition lives in a small constant array in `src/features/shiftView/standards.ts` mapping `task_name → standardKey`. Templates are matched by name; anything unmatched falls into a "Other" group (so admin-added tasks still show).

### Referral row (inside Standard 4)

A custom component `ReferralAskRow.tsx`:

- Member-name input with autocomplete from `referral_asks.member_name` (case-insensitive distinct).
- As they type, query `referral_asks` for matches in the last 30 days for that member; if any, show muted warning: *"You already asked {name} on {date}."* (does not block).
- Friend-name input.
- "Save ask" button → insert into `referral_asks` with `sa_name`, `shift_date`, `shift_type`, `asked_at = now()`.
- Small list-icon button beside the inputs → opens a `Sheet` (`ReferralAskHistorySheet.tsx`) listing this week's + all-time asks, searchable by member name, sortable by date. Reads from the same `referral_asks` table — no other source.
- Each save also flips the standard 4 "ask a member" template task to `completed = true` for today (so the checkbox visibly catches up).

### `EndOfShiftSubmission.tsx` (new, rendered last in `ShiftViewPage`)

- Card titled **"Close out your shift"** with a single checkbox row: *"Answer the three questions to submit."*
- Three labeled `Textarea`s (one per header question), autosave-on-blur into `shift_submissions` (upsert by unique key).
- "Submit shift" button — disabled until all three answers are non-empty. On click sets `submitted_at = now()`.
- After submit, header preview shows the answers + a "Submitted at h:mm a" stamp, button becomes "Edit & resubmit" (clears `submitted_at` on save).

### Honesty disclaimer cleanup

The existing inline disclaimer above "Shift duties" in `ShiftTaskList.tsx` moves up into the new header card (single source). Remove the duplicate from `ShiftTaskList.tsx`.

## Downstream cleanup audit

- **Hardcoded targets**: `count_target` is rendered in `ShiftTaskList.tsx` (lines 232, 283–289). Drop both. Grep also covers `WigSaLeaderboard.tsx`, `useSaLeaderboard.ts`, `useLeadMeasures.ts`, `MyDayShiftSummary.tsx` — confirm none display literal "20 DMs / 20 texts / 10 follow-ups" strings; remove any found.
- **Counter sync**: `syncOutreachCounter` (writes to `daily_outreach_log` when label is "DMs sent" / "Texts sent") stays — that's the WIG feed. Verify the new template seed uses those exact `count_label` values so the sync keeps firing.
- **Shift-type label standardization**: ShiftView uses `morning|mid|last|weekend`; `shift_recaps` uses `AM|Mid|PM Shift` and has no Weekend. Don't change `shift_recaps` constraint in this build (it's referenced by `intros_booked`, `intros_run`, `sales_outside_intro`, `daily_recaps`); instead document that **ShiftView writes only to `shift_task_completions` + `shift_submissions` + `referral_asks**`, never to `shift_recaps`. `MyDayShiftSummary` continues to own `shift_recaps`. The two surfaces stay in their lanes.
- `**SHIFT_LABELS**`: keep `Morning / Mid / Last / Weekend` as the canonical display names in `ShiftViewPage.tsx` and `ShiftSelector.tsx` (already correct). Grep for stray "Last Shift" / "Evening" / "PM Shift" labels in shift-view code paths and normalize.
- **Referral list source**: `ReferralAskHistorySheet`, the autocomplete, the guard-rail warning, and the weekly export all read `referral_asks`. No second source.
- **Realtime**: subscribe to `referral_asks` and `shift_submissions` in the shift view so concurrent SAs see updates live (matches the `useRealtimeMyDay` pattern).

## Weekly Own It export additions

In `src/lib/table/exportOwnIt.ts` add a Referrals block per-week:

- Total referral asks this week (count of `referral_asks` where `shift_date` in week range).
- Members asked more than once in the trailing 30 days — flag list.
- Members in `referral_asks` historically who have **not** been asked in the trailing 90 days — surfaced as "never asked recently" list. (Spec says "members never asked"; without a member roster table we can only surface from people who appear in past asks; document this limitation in the export footer.)

## Files touched

- New migration: create `shift_submissions`, create `referral_asks` (+ indexes + RLS), reseed `shift_task_templates`, set `count_target = NULL`.
- New: `src/features/shiftView/standards.ts`, `EndOfShiftSubmission.tsx`, `ReferralAskRow.tsx`, `ReferralAskHistorySheet.tsx`, `useShiftSubmission.ts`, `useReferralAsks.ts`.
- Edited: `ShiftViewPage.tsx` (sticky header + end-of-shift card + realtime), `ShiftTaskList.tsx` (group by standard, drop targets, drop duplicate disclaimer, hand off the referral row).
- Edited: `src/lib/table/exportOwnIt.ts` (Referrals block).
- Edited: `useRealtimeMyDay.ts`-equivalent or local channel in shift view for `referral_asks` + `shift_submissions`.

## Out of scope

- No changes to `shift_recaps` schema or to `MyDayShiftSummary`.
- No member roster table — referral history reads only from `referral_asks`.
- No goal/target UI re-introduction; numbers log silently.
- No password auth, no role changes.

## Open question before I build

The spec says "members never asked surfaced as a separate list." There is no canonical member roster in the DB — only people who appear in `intros_run` (sales) or `referrals` (booking-linked friend referrals). Two options:

1. **Sales-based**: roster = distinct member names from sold intros (`intros_run.result_canon = 'SALE'`). "Never asked" = in roster, not in `referral_asks` in last 90 days.
2. **Asks-based only**: only flag people who appear in `referral_asks` historically and haven't been asked in 90 days.

Recommend option 1 (sales-based roster) — it's the closest thing to "current members" the DB has. **Confirm before I build the export block.**