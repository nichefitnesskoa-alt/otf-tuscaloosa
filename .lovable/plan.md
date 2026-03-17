

## Problems Identified

There are **two attribution mismatches** in `useLeadMeasures.ts`:

### 1. Prep% uses a different SA than Ran
- **Prep% denominator** (line 89-101): Attributes each booking to the **first match** from `[intro_owner, prepped_by, booked_by]`. So if Kayla booked 3 intros but only owns 2 runs, her prep denominator is 3 but her "Ran" column shows 2 — giving impossible-looking percentages like 33%.
- **Ran column** (line 104-112): Attributes each run to `r.intro_owner || r.sa_name` from the `intros_run` table.

These are two different attribution paths. A booking might attribute to "Kayla" via `booked_by`, but the run attributes to "Bri" via `intro_owner`. This means the Prep denominator and Ran count don't align per SA.

### 2. Q% has the same mismatch
- Q% numerator/denominator uses the booking's `[intro_owner, prepped_by, booked_by]` fallback chain, while Ran uses the run's `intro_owner`. Same person-mismatch problem.

### 3. Prep% includes ALL bookings, not just showed
- `prepTotal` increments for every booking (line 100), including future/pending bookings and no-shows. This inflates the denominator beyond what "Ran" reflects.

---

## Plan

### Single fix in `src/hooks/useLeadMeasures.ts`

**Unify attribution around `intro_owner` consistently**, and scope Prep% denominator to only showed bookings (matching Ran):

1. **Q% and Prep% attribution**: Change line 90 to use `b.intro_owner` (falling back to `b.prepped_by` only). Remove `booked_by` from the fallback chain — the person who *booked* isn't necessarily the person who *owns* the intro and runs it. This matches the memory note that says "Attributes Prep% and Q% credit by prioritizing the 'prepped_by' field."

2. **Prep% denominator**: Move the `prepTotal++` / `prepDone++` logic inside the `showedBookingIds.has(b.id)` guard (lines 96-101), so prep rate only counts bookings where the member actually showed. This makes Prep% denominator = Ran count for each SA.

3. **Attribution alignment**: Use `b.intro_owner || b.prepped_by` for Q/Prep (prioritize the intro owner, fall back to prepper). This matches how Ran attributes via `r.intro_owner || r.sa_name`.

Result: For each SA, Q%, Prep%, and Ran will all be based on the same set of showed intros attributed to the same person.

