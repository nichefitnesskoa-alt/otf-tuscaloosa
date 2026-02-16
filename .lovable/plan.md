

# Fix: Per-SA Close Rate Shoutout Inflated by Non-Intro Sales

## Problem

In the Team Meeting shoutouts, the "Close Rate" category uses a `saRun` map that includes both intro-based sales AND `sales_outside_intro` records (lines 562-567). So if Sophie showed 5 intros and closed 3, but also had 3 `sales_outside_intro`, her close rate shows as 6/5 = 120%.

The "Total Sales" shoutout should still include all sales (intro + outside). But "Close Rate" should only reflect intro-run conversions.

## Fix

In `src/hooks/useMeetingAgenda.ts`, in `generateShoutoutCategories`:

1. Stop adding `sales_outside_intro` into the `saRun` map's `sales` field.
2. Instead, track outside sales in a separate counter for the "Total Sales" shoutout.
3. "Close Rate" shoutout uses only intro-run sales from `saRun`.
4. "Total Sales" shoutout combines intro sales + outside sales.

## Technical Details

**File**: `src/hooks/useMeetingAgenda.ts`

- Lines 544-567: Split `saRun` so it only tracks intro-run sales/showed. Create a separate `saOutsideSales` map for `sales_outside_intro`.
- Lines 629-637: Close Rate shoutout stays as-is (already uses `saRun.sales`, which will now only be intro sales).
- Lines 640-649: Total Sales shoutout combines `saRun.sales + saOutsideSales` per SA.

This is a ~10-line change in one file.
