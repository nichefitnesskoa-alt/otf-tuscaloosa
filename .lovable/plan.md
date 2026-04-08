
## Summary
- Remove the top Lead to Booked %, Booked to Shown %, and the entire Live Conversion Funnel.
- Leave only two top cards: Leads and Close Rate.
- Fix Coach Lead Measures so coach answers actually populate in WIG again.

## Root cause found
- `src/pages/Wig.tsx` is querying `intros_run` for `coach_shoutout_start` and `coach_shoutout_end`.
- Those fields live on `intros_booked`, not `intros_run`.
- That makes the coach-measures load fail or return empty, so the WIG coach table can look blank even when coaches answered the debrief questions.
- The page is also over-dependent on run rows for coach reporting, which can hide coach-entered answers.

## Affected file
- `src/pages/Wig.tsx`

## Implementation
1. Simplify the top of WIG
   - Remove the Lead to Booked card.
   - Remove the Booked to Shown card.
   - Remove the Live Conversion Funnel card entirely.
   - Keep the Leads card and the Close Rate card only.
   - Keep the current date filter, lead target editing, pacing note, manual refresh, and saved feedback.

2. Rebuild Coach Lead Measures from the correct sources
   - Use `intros_booked` as the base dataset for coach measures:
     - first intros only
     - non-deleted / non-VIP
     - selected date range
     - showed classes only
   - Read booking-side coach fields from `intros_booked`:
     - `shoutout_consent`
     - `coach_shoutout_start`
     - `coach_shoutout_end`
     - `coach_debrief_submitted`
     - `coach_name`
   - Join linked `intros_run` rows by `linked_intro_booked_id` for run-side coach fields:
     - `goal_why_captured`
     - `made_a_friend`
     - close outcome fields
   - Keep NULL-aware math:
     - unanswered values stay out of both numerator and denominator
     - debrief rate stays based on submitted debriefs
   - Keep role visibility the same:
     - coaches see only themselves
     - Koa/Admin can see all coaches

3. Preserve existing close-rate behavior
   - Do not rework the studio close-rate logic.
   - Only remove the unused top conversion metrics and funnel UI.
   - Keep the top Close Rate card working off the existing WIG close-rate calculation.

## Technical details
- No database migration is needed.
- No coach card UI change is required for this fix unless QA shows a separate save-path bug.
- The existing `coach_wig_summary` view is not what this page is using today, so this fix stays in the current WIG page logic instead of changing backend reporting.

## Data connections / downstream effects
- `monthly_lead_totals`: unchanged, still powers the lead total input
- `studio_settings`: unchanged, still stores the editable lead target
- `intros_booked`: becomes the source of truth for coach attendance/debrief/shoutout fields
- `intros_run`: still supplies run-only coach answers and close outcomes
- SA Lead Measures, Milestones, and the rest of WIG stay unchanged

## Validation
- Confirm the top area now shows only 2 cards.
- Confirm Koa’s coach answers appear in the WIG Coach Lead Measures table.
- Confirm Coach role still only sees their own row.
- Confirm lead target editing and pacing still save and render correctly.
- Confirm SA Lead Measures still load normally after the WIG refactor.

## Audit against the 4 standards
- Simplifies the job: only the 2 numbers you actually care about stay at the top.
- Surfaces info at the right moment: coach accountability shows in the coach table, not hidden behind a broken query.
- Ensures data accuracy: coach metrics will read from the tables where those answers are actually saved.
- Maintains intuitiveness: no extra funnel, no dead percentages, no mismatch between what coaches answer and what WIG shows.

## What will not change
- No new tables, no schema changes, no auth changes
- No Coach View layout changes
- No SA workflow changes
- No Milestones / Deploy changes
