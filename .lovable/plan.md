
# Three Targeted Fixes

## Fix 1: Scoreboard vs Funnel Mismatch — Align Date Filtering

### Root Cause
The funnel's "Sold" count and the scoreboard's "Sales" count use different anchoring logic:

- **Scoreboard** (`useDashboardMetrics.ts`): For each SA, counts all runs where `isSaleInRange(run, dateRange)` is true — this checks `buy_date ?? run_date ?? created_at` against the date range. The run can come from any booking, even one outside the date window.

- **Funnel** (`ConversionFunnel.tsx`): First filters `introsBooked` to those where `class_date` is in the date range, then counts runs linked to those bookings. A sale with `buy_date` in range but linked to a booking where `class_date` is outside range is invisible to the funnel.

The funnel "Sold" is **booking-anchored**, the scoreboard is **sale-date-anchored**. They will produce different numbers whenever a follow-up sale closes in a period after the original booking.

### Fix
Change the funnel's `computeFunnel()` function's `sold` calculation from:
```
booking-anchored: if this booking's linked runs contain a sale in range → sold++
```
to:
```
sale-date-anchored: count all runs (across all bookings) where isSaleInRange() is true
```

The `showed` count stays booking-anchored (how many people showed up, filtered by booking date). Only `sold` switches to match the scoreboard's logic.

Specifically, in `ConversionFunnel.tsx` `computeFunnel()`:
- Remove the per-booking `runs.some(r => isSaleInRange(...))` check
- Instead, collect all active intros_run records (filtered by the same booking status exclusions and 1st/2nd filter) and count those where `isSaleInRange(r, dateRange)` is true

The 1st/2nd filter still applies to `sold` — a sale from a 1st-intro booking still counts toward 1st-intro sold. This is done by only looking at runs linked to filtered bookings (no class_date restriction on the booking, just the 1st/2nd filter), or more precisely: counting `isSaleInRange` runs that are linked to any booking that passes the intro-type filter.

**Implementation in `computeFunnel`:**
```typescript
const computeFunnel = (filter: IntroFilter) => {
  // Filter bookings for 1st/2nd type only (no class_date filter for the sold count)
  const typeFilteredBookingIds = new Set(
    introsBooked
      .filter(b => {
        const status = ((b as any).booking_status || '').toUpperCase();
        if (status.includes('DUPLICATE') || status.includes('DELETED') || status.includes('DEAD')) return false;
        if ((b as any).ignore_from_metrics) return false;
        if ((b as any).is_vip === true) return false;
        if (filter === '1st') return isFirstIntro(b);
        if (filter === '2nd') return !isFirstIntro(b);
        return true;
      })
      .map(b => b.id)
  );

  // Booked: bookings in date range (class_date filtered)
  const activeBookings = introsBooked.filter(b => {
    if (!typeFilteredBookingIds.has(b.id)) return false;
    return isInRange(b.class_date, dateRange || null);
  });
  const booked = activeBookings.length;

  // Showed: based on bookings in date range (booking metric)
  let showed = 0;
  const activeBookingIds = new Set(activeBookings.map(b => b.id));
  activeBookings.forEach(b => {
    const runs = introsRun.filter(r => r.linked_intro_booked_id === b.id);
    const showedRuns = runs.filter(r => r.result !== 'No-show' && isRunInRange(r, dateRange || null));
    if (showedRuns.length > 0) showed++;
  });

  // Sold: sale-date-anchored (matches scoreboard logic)
  // Count runs from type-filtered bookings where isSaleInRange() is true
  const sold = introsRun.filter(r =>
    r.linked_intro_booked_id && typeFilteredBookingIds.has(r.linked_intro_booked_id) &&
    isSaleInRange(r, dateRange || null)
  ).length;

  return { booked, showed, sold };
};
```

**File:** `src/components/dashboard/ConversionFunnel.tsx`

---

## Fix 2: Intro Run Logging — Auto-Populate from Booking Record

### Root Cause
In `applyIntroOutcomeUpdate`, Step A2 (create run if missing, lines 97–128) inserts a new `intros_run` record with hardcoded values:
- `class_time: '00:00'` — not the real class time
- No `coach_name` field populated
- No `sa_working_shift` field populated

The booking record (`intros_booked`) contains `class_start_at` (the actual class time), `coach_name`, and `sa_working_shift`. These should be read from the booking and written to the run.

### Fix
In `applyIntroOutcomeUpdate`, before the "CREATE RUN IF MISSING" block, fetch the booking record when `params.bookingId` is available. Then use those values when inserting the run.

**Specifically, modify the CREATE block (lines 97–128) in `applyIntroOutcomeUpdate.ts`:**

```typescript
// A2: CREATE RUN IF MISSING
if (!existingRun && params.bookingId) {
  // Fetch booking to auto-populate run fields
  const { data: bookingData } = await supabase
    .from('intros_booked')
    .select('class_start_at, coach_name, sa_working_shift, class_date')
    .eq('id', params.bookingId)
    .maybeSingle();

  const runDate = bookingData?.class_start_at
    ? bookingData.class_start_at.split('T')[0]
    : (params.classDate || getTodayYMD());

  // Extract HH:MM from class_start_at if available
  const classTime = bookingData?.class_start_at
    ? bookingData.class_start_at.split('T')[1]?.substring(0, 5) || '00:00'
    : '00:00';

  const { data: newRun, error: createErr } = await supabase
    .from('intros_run')
    .insert({
      linked_intro_booked_id: params.bookingId,
      member_name: params.memberName,
      run_date: runDate,
      class_time: classTime,
      coach_name: bookingData?.coach_name || null,       // auto-populated from booking
      sa_working_shift: bookingData?.sa_working_shift || null, // auto-populated from booking
      result: params.newResult,
      result_canon: normalizeIntroResult(params.newResult),
      lead_source: params.leadSource || null,
      sa_name: params.editedBy,
      intro_owner: params.editedBy,
      commission_amount: resolvedCommission,
      primary_objection: params.objection || null,
      buy_date: isNowSale ? getTodayYMD() : null,
      created_at: new Date().toISOString(),
      last_edited_at: new Date().toISOString(),
      last_edited_by: params.editedBy,
      edit_reason: params.editReason || `Run auto-created via ${params.sourceComponent}`,
    })
    ...
```

**File:** `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts`

---

## Fix 3: HRM Add-On — Update Original Record, No Duplicate

### Root Cause
**Heather Chiarella duplicate:** She has two `intros_run` records:
- `cf4bc890` — `run_date: 2026-02-09`, `buy_date: null`, `result: Premier w/o OTBeat`, `commission: $7.50`
- `969d2b46` — `run_date: 2026-02-10`, `buy_date: 2026-02-16`, `result: Premier w/o OTBeat`, `commission: $7.50`

Both appear in Members Who Bought because `isMembershipSale("Premier w/o OTBeat")` is true (contains "premier"). The `cf4bc890` record has no buy_date — its effective date falls back to `run_date: 2026-02-09`, which is in the current pay period. The `969d2b46` record has `buy_date: 2026-02-16`. Both pass the date filter, causing the duplicate appearance.

**Fix:** Delete the record `cf4bc890` (the stale one with no buy_date and the earlier run_date, linked to a different booking). Keep `969d2b46` which has the actual buy_date.

**Future HRM add-on behavior:** Currently, `FollowupPurchaseEntry.tsx` line 141–164 always inserts a new `sales_outside_intro` row for HRM add-ons, regardless of whether the member already has an existing membership. The fix: before inserting, look up `intros_run` for this member where `isMembershipSale(result)` is true and `buy_date` is in the current pay period. If found, update that run's result to the `+ OTbeat` version and update the commission. If not found, proceed with the existing `sales_outside_intro` insert.

**Tier upgrade mapping:**
- `Premier w/o OTBeat` or `Premier` → `Premier + OTbeat`
- `Elite w/o OTBeat` or `Elite` → `Elite + OTbeat`
- `Basic w/o OTBeat` or `Basic` → `Basic + OTbeat`

Note: the `isMembershipSale()` function checks for "premier", "elite", "basic" — "Premier w/o OTBeat" matches because it contains "premier". The same is true of "Premier + OTbeat". So both are already detected as membership sales and will appear in the scoreboard.

**File:** `src/components/FollowupPurchaseEntry.tsx`

---

## Data Fix (Heather Chiarella)

Delete run `cf4bc890` from `intros_run` using the Supabase insert tool (DELETE operation). This removes the stale duplicate entry for Heather Chiarella.

---

## File Change Summary

| File | Change |
|---|---|
| `src/components/dashboard/ConversionFunnel.tsx` | Change `sold` count to use sale-date-anchoring (isSaleInRange) over all type-filtered booking runs, matching scoreboard logic |
| `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts` | Fetch booking record before creating run; auto-populate `run_date`, `class_time`, `coach_name`, `sa_working_shift` |
| `src/components/FollowupPurchaseEntry.tsx` | On HRM add-on submit: check for existing membership run in current period; if found, update to OTbeat version; if not, create outside_intro as before |
| DB (intros_run) | Delete duplicate Heather Chiarella run record `cf4bc890-663e-4323-b4fa-8fdf60857882` |

## Acceptance Checklist

| Check | How Verified |
|---|---|
| Funnel Sold = Scoreboard Sales for same date range | Both now use `isSaleInRange()` over sale-date-anchored runs |
| New run auto-shows booking's coach and class time | `applyIntroOutcomeUpdate` fetches and writes these from `intros_booked` |
| Heather Chiarella: 1 row only | Duplicate run deleted |
| Premier + HRM → Premier + OTbeat in one row | FollowupPurchaseEntry checks for existing membership before creating new row |
| Total Sales not inflated by merged HRM records | Merged records replace, not add |
