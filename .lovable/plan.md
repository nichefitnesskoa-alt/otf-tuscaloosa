

# Plan: Three Fixes — Questionnaire in Prep, Phone Normalization, Missed Guest Filter

## FIX 1 — "What They Told Us" in PrepDrawer

**File: `src/components/dashboard/PrepDrawer.tsx`**

### Interactive view (insert between Shoutout Consent section and Dig Deeper section, ~line 437)

Add a new section "WHAT THEY TOLD US" that renders only when `hasQ` is true. Structure:
- Section header: `WHAT THEY TOLD US` with a ClipboardList icon
- Each field rendered as a row: muted label on left, verbatim answer on right
- **Goal, Why, Obstacle**: rendered with `text-sm font-semibold` (visually prominent)
- **Other fields** (Past experience, Fitness Level, Commitment, Available days, Coach notes): rendered with `text-xs`
- Each field only renders if the value is non-null and non-empty
- If `!hasQ`: show a muted italic line "No questionnaire answers yet"

Fields in order:
1. Goal → `questionnaire.q1_fitness_goal`
2. Why → `questionnaire.q5_emotional_driver`
3. Obstacle → `questionnaire.q3_obstacle`
4. Past experience → `questionnaire.q4_past_experience`
5. Fitness Level → `questionnaire.q2_fitness_level` displayed as `X/5`
6. Commitment → `questionnaire.q6_weekly_commitment` displayed as `X days/week`
7. Available days → `questionnaire.q6b_available_days`
8. Coach notes → `questionnaire.q7_coach_notes`

### Print layout (insert between one-liner block and shoutout consent block, ~line 712)

Condensed version inside the SA half:
```
WHAT THEY TOLD US
Goal: "[answer]"
Why: "[answer]"
Obstacle: "[answer]"
Level: X/5 | Commit: X days/week
Notes: "[answer]"
```
Only show fields with values. Use `fontSize: '10px'` to fit on the page.

---

## FIX 2 — Phone Numbers

### Part A — Phone display already works

The `useUpcomingIntrosData` hook already selects `phone`, `phone_e164`, and `email`, with fallback logic including `extractPhone` from email and inheritance from originating bookings. The `formatPhoneDisplay` function already strips country codes correctly via `stripCountryCode`. No code change needed for data flow.

### Part B — PrepDrawer phone display fix

**File: `src/components/dashboard/PrepDrawer.tsx`** (line 382)

The phone in the Quick Info section renders raw without `formatPhoneDisplay`. Import and apply it:
- Change `{phone}` to `{formatPhoneDisplay(phone) || phone}` on line 382

### Part C — DB migration to normalize stored phone values

Run a migration to strip `+1` and leading `1` from `phone` columns on `intros_booked`, `leads`, and `vip_registrations`. The `intros_run` table has no `phone` column, so it's skipped.

```sql
-- intros_booked
UPDATE intros_booked SET phone = substring(phone from 2)
WHERE phone IS NOT NULL AND phone ~ '^1\d{10}$';
UPDATE intros_booked SET phone = substring(phone from 3)
WHERE phone IS NOT NULL AND phone ~ '^\+1\d{10}$';

-- leads
UPDATE leads SET phone = substring(phone from 2)
WHERE phone IS NOT NULL AND phone ~ '^1\d{10}$';
UPDATE leads SET phone = substring(phone from 3)
WHERE phone IS NOT NULL AND phone ~ '^\+1\d{10}$';

-- vip_registrations
UPDATE vip_registrations SET phone = substring(phone from 2)
WHERE phone IS NOT NULL AND phone ~ '^1\d{10}$';
UPDATE vip_registrations SET phone = substring(phone from 3)
WHERE phone IS NOT NULL AND phone ~ '^\+1\d{10}$';
```

### Part D — Audit all phone render locations

Verify `formatPhoneDisplay` is called everywhere phones render. Based on search, all major locations already use it. The one gap is `PrepDrawer.tsx` line 382 (fixed in Part B).

---

## FIX 3 — Remove Missed Guests with 2nd Intro Scheduled

### File: `src/features/pipeline/selectors.ts` (line 254-257)

Update the `missed_guest` case to add an exclusion check:

```typescript
case 'missed_guest':
  if (hasPurchased) return false;
  if (journey.status === 'not_interested') return false;
  // Exclude if they have an upcoming unrun 2nd intro
  const hasUpcoming2ndIntro = journey.bookings.some(b =>
    b.originating_booking_id &&
    (b.booking_status_canon === 'ACTIVE' || !b.booking_status || b.booking_status === 'Active') &&
    isBookingUpcoming(b)
  );
  if (hasUpcoming2ndIntro) return false;
  return journey.runs.some(r => r.result === 'Follow-up needed' || r.result === "Didn't Buy" || r.result === 'Booked 2nd intro');
```

Also update the `computeTabCounts` function (~line 180-184) with the same exclusion logic.

### File: `src/components/admin/ClientJourneyPanel.tsx` (line 664-669)

Apply the same exclusion to the admin panel's `missed_guest` case:

```typescript
case 'missed_guest':
  if (hasPurchased) return false;
  const hasUpcoming2nd = journey.bookings.some(b =>
    b.originating_booking_id &&
    (!b.booking_status || b.booking_status === 'Active') &&
    isBookingUpcoming(b)
  );
  if (hasUpcoming2nd) return false;
  return journey.runs.some(r =>
    r.result === 'Follow-up needed' || r.result === 'Booked 2nd intro'
  );
```

---

## Summary of Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/PrepDrawer.tsx` | Add "What They Told Us" section (interactive + print), fix phone display |
| `src/features/pipeline/selectors.ts` | Exclude 2nd-intro-scheduled from missed_guest filter + count |
| `src/components/admin/ClientJourneyPanel.tsx` | Same missed_guest exclusion |
| DB migration | Normalize phone values across 3 tables |

