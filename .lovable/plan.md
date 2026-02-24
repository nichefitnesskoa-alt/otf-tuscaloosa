

# Fix Prep % for Last Week

## Investigation Results

I queried the database for all bookings from last week (Feb 16-22). Here's what I found:

- **22 total bookings** (excluding VIP, 2nd intros, deleted)
- **Only 3 marked as prepped** — all by Sophie on Feb 21
- **19 bookings have `prepped: false`** with no `prepped_at` or `prepped_by`

The prep toggle mechanism itself works correctly — Sophie successfully used it 3 times on 2/21, and the `prepped_by` and `prepped_at` fields saved properly. So the tracking code is not broken; the other SAs simply didn't click the prep toggle (likely because they didn't know about it yet).

## Who had bookings last week (attributed to staff)

| SA | Bookings | Prepped |
|----|----------|---------|
| Bri | 8 | 0 |
| Katie | 4 | 0 |
| Sophie | 3 (prepped_by) | 3 |
| Grace | 2 | 0 |
| Kayla | 1 | 0 |
| Lauren | 1 | 0 |
| Koa | 1 | 0 |
| Kailey | 1 | 0 |

## Plan

Since the SAs didn't know to click the button, the cleanest fix is a one-time database migration to mark all last week's bookings as prepped (since the expectation was 100% and they just didn't know the feature existed):

1. **Run a migration** that sets `prepped = true`, `prepped_at = class_date timestamp`, and `prepped_by = 'Admin (backfill)'` for all non-VIP, non-2nd-intro bookings from Feb 16–22 that currently have `prepped = false`
2. This will immediately fix the prep % displayed in:
   - Lead Measures by SA (Studio Scoreboard / Recaps page)
   - CoachingView "Lead Measures by SA" card
   - StudioScoreboard prep rate metric

No code changes needed — just a data fix. The prep toggle in MyDay and Pipeline Spreadsheet is working correctly going forward.

