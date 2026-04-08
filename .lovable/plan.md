

# Coach Lead Measures Accuracy + Debrief Submit Flow

## Summary
Four changes: (1) Filter coach lead measures to only count showed intros, (2) Remove default toggle states so NULL = unanswered, (3) Add Submit button with validation, (4) Show debrief status badge on collapsed cards. Plus debrief_rate column in WIG table.

## Database Migration

Add three columns to `intros_booked`:
```sql
ALTER TABLE public.intros_booked
  ADD COLUMN coach_debrief_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN coach_debrief_submitted_at timestamptz,
  ADD COLUMN coach_debrief_submitted_by text;
```

## File Changes

### 1. `src/pages/Wig.tsx` — Coach measures filter + Debrief Rate column

**Coach measures query filter (lines 364-377):**
Currently `periodRuns` includes all first-intro runs regardless of outcome. Add filter to exclude no-shows and unresolved:
```
periodRuns = firstIntroRuns.filter(r => {
  // Exclude no-shows and unresolved
  if (r.result_canon === 'NO_SHOW' || r.result_canon === 'UNRESOLVED') return false;
  // existing date range filter...
});
```

**NULL-aware rate calculations (lines 397-407):**
Currently counts all `periodRuns` in denominator. Change to only count runs where the field is explicitly answered (not NULL):
- `shoutouts`: count only where `coach_shoutout_start` is not null OR `coach_shoutout_end` is not null
- `whyUsed`: count only where `goal_why_captured` is not null
- `friends`: count only where `made_a_friend` is not null

Track separate `answered_*` counts for each metric to use as denominators instead of `coached`.

**Add Debrief Rate column:**
- Fetch `coach_debrief_submitted` from `intros_booked` for linked bookings
- Calculate `debrief_rate = (submitted count / showed first intros) * 100`
- Add column header "Debrief %" to Coach Lead Measures table
- Color: green ≥ 90%, amber ≥ 70%, red below

### 2. `src/components/coach/CoachIntroCard.tsx` — Neutral defaults + Submit button

**Remove default states (lines 73-76):**
```typescript
// Before:
const [shoutoutStart, setShoutoutStart] = useState(booking.coach_shoutout_start ?? false);
// After:
const [shoutoutStart, setShoutoutStart] = useState<boolean | null>(booking.coach_shoutout_start ?? null);
```
Same for `shoutoutEnd`. For `usedWhy` and `introducedMember`, initialize from `runData` in the useEffect (line 114-116) keeping null until loaded.

**Add debrief submitted state:**
- Fetch `coach_debrief_submitted`, `coach_debrief_submitted_at`, `coach_debrief_submitted_by` from intros_booked on load
- Add `[debriefSubmitted, setDebriefSubmitted]` state

**Add Submit button after Row 2:**
- Full-width, orange `#E8540A` background, white bold "Submit Lead Measures", 44px height
- On tap: validate all 5 toggles are non-null. If any null, highlight with amber border + inline error message
- If all answered: update `coach_debrief_submitted = true`, `coach_debrief_submitted_at = now()`, `coach_debrief_submitted_by = coachName`
- After submit: button turns green "Lead Measures Submitted ✓" with subtitle "Submitted by [name] at [time]", disabled
- Section header updates to "POST-CLASS — LEAD MEASURES ✓"

**YesNoToggle neutral state:**
Already handles `value === null` correctly — both buttons show gray outlined. No change needed to the component itself, only the initial state values.

### 3. `src/pages/CoachView.tsx` — Debrief badge on collapsed card

**Collapsed card header (around line 370-385 in ClassTimeIntroSelector):**
- Fetch `coach_debrief_submitted` in the booking select query (line 104)
- Add to CoachBooking interface
- In collapsed header, after the questionnaire badge:
  - If `coach_debrief_submitted === true`: green badge "Debrief ✓"
  - If `coach_debrief_submitted === false/null` AND class time is past (Central Time): amber badge "Debrief needed"
  - If class hasn't happened yet: no badge

## What does NOT change
- SA view, Pipeline, Follow-Up tabs
- Database views (no coach_wig_summary view exists — calculations are inline in Wig.tsx)
- Close rate denominator (already excludes no-shows by filtering `result_canon`)
- Realtime subscriptions

## Downstream effects
- WIG Coach Lead Measures table will show more accurate rates (only showed intros in denominator)
- Debrief Rate gives admin visibility into coach compliance
- NULL toggles mean historical debriefs without explicit answers won't inflate or deflate rates

