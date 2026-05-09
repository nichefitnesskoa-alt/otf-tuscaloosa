## What's wrong

The Studio Scoreboard shows **9 Intros Run / 7 Sales** while the WIG tab and the Per-Coach Performance table both show **10 ran / 7 sales** (Koa 5 + James 4 + Nathan 1 = 10). The Conversion Funnel under Studio also shows the lower number (1st intro Showed = 9, Sold = 6).

This is the same Alexa Brodsky orphan case from the previous fix — just in two surfaces we missed.

### Root cause

In the previous round we centralized the "orphaned 2nd-intro promotion" logic into `src/lib/intros/orphanedFirstIntros.ts` and wired it into:
- `src/pages/Wig.tsx` (WIG tab)
- `src/components/dashboard/PerCoachTable.tsx` (Per-Coach table)

But two other surfaces still use the old `!originating_booking_id || referred_by_member_name` rule and never see promoted orphans:

1. **`src/hooks/useDashboardMetrics.ts`** (line 165) — its `firstIntroBookings` set feeds:
   - `pipelineShowed` → Studio Scoreboard "Intros Run" (9 instead of 10)
   - `studioIntroSales` / `effectiveStudioRan` → Scoreboard sales + close rate
   - `perSAData` → Sales tab Runner Stats
2. **`src/components/dashboard/ConversionFunnel.tsx`** (lines 56, 105) — its own first-intro filter drives the 1ST INTRO Booked/Showed/Sold tiles.

Because both still ignore the promoted orphan child (Alexa's May 4 sale child of a deleted original), Alexa is excluded from both denominators and the sale numerator.

## Fix

Bring the same `resolvePromotedOrphanBookingIds` / `isFirstIntroForMetrics` helpers into both surfaces so every Studio number matches WIG.

### 1. `src/hooks/useDashboardMetrics.ts`
- Compute `promotedOrphanIds = resolvePromotedOrphanBookingIds(activeBookings, activeRuns)` once, after `activeBookings` / `activeRuns` are built.
- Replace the `firstIntroBookings` filter (line 165) with `isFirstIntroForMetrics(b, promotedOrphanIds)` plus the existing date-range check.
- All downstream sets (`firstIntroBookingIds`, `pastAndTodayBookings`, `firstIntroBookingsNoSelfBooked`, per-SA loops, pipeline counts) automatically pick up the promoted booking, so Scoreboard "Intros Run" goes 9 → 10 and Per-SA Runner Stats stays consistent with Per-Coach.

### 2. `src/components/dashboard/ConversionFunnel.tsx`
- Same pattern: build `promotedOrphanIds` from the same booking + run inputs the funnel already loads, and update both first-intro checks (lines 56 and 105) to treat promoted IDs as 1st intros. 2nd-intro logic (`hasOrig`) gets the inverse so Alexa isn't double-counted on the 2nd-intro row.

### 3. Regression coverage
- Extend `src/lib/intros/__tests__/orphanedFirstIntros.test.ts` with one test asserting that for the Alexa shape (deleted original + follow-up child + sale child), `isFirstIntroForMetrics` returns true for exactly one booking — the sale child — so Studio Scoreboard, Per-Coach, Per-SA, Funnel, and WIG all converge on the same count.
- Run the full vitest suite; expect previous 121 + new test to pass.

### Out of scope
- No data migration. This is purely a metric-attribution fix.
- Booker stats, lead-source, milestones, etc. continue to use their existing rules; they don't drive the numbers in question.
- Cases where the original 1st intro is NOT excluded remain unchanged.

### Expected result after fix
Studio Scoreboard: **10 Intros Run / 7 Sales / 70% Close Rate**, Conversion Funnel 1st Intro: **Showed 10 / Sold 7**, Per-Coach unchanged at 10/7, WIG unchanged at 10/7. All four surfaces match.
