## What's actually happening with Jasmine Walker

I queried the database directly. Jasmine Walker has **only one sale in the system — Elite, $6 commission, buy_date 5/28**. There is **no Premier sale** anywhere in `intros_run` or `sales_outside_intro` for her.

What you're seeing in the screenshot is a **display bug**, not a duplicate sale:

- 1st intro on 5/20 → result `SECOND_INTRO_SCHEDULED` (Booked 2nd)
- 2nd intro on 5/22 → result `Elite` (the only actual sale)

The WIG "Closes" drilldown is listing Jasmine **twice** — once for the originating 1st intro (credited via Total Journey) and once for the 2nd intro itself. Both show "SALE · via 2nd intro" because they both point at the same Elite close. That's why it looks like two memberships.

So the right fix is two-fold: (1) kill the duplicate row in the Closes drilldown, and (2) make the Pipeline tab genuinely usable for finding and deleting a sale when one does need to go away.

---

## Part 1 — Fix the duplicate Close row (WIG drilldown)

In `CoachAttributionDrillDown.tsx`, when building the Close list, dedupe by the underlying sale record (intros_run.id for direct, or root journey id for "via 2nd intro"). For a journey where the sale lives on the 2nd intro:

- Show **one** row, labeled `via 2nd intro`, dated by the sale (buy_date), keyed to the 2nd-intro run.
- Do not also emit a separate row for the originating 1st-intro booking.

This makes the count match reality (Jasmine = 1 close, not 2) and matches the summary line "Counted as Close (2nd intro · Total Journey)".

## Part 2 — Pipeline tab cleanup

The Pipeline today is a wide spreadsheet with delete actions buried 2 levels deep in row dropdowns. Proposed cleanup, in priority order:

### A. Add a "Sales" tab (highest impact for your use case)

A dedicated tab at the top of Pipeline that lists **every sale** (intros_run with SALE canon + sales_outside_intro), one row per sale, with:

- Member name, buy_date, membership tier, commission, source (1st intro / 2nd intro / outside)
- Inline **Edit** (change tier / commission / buy_date) and **Delete** buttons — no dropdown hunting
- Search by name, filter by month / tier / coach
- For a case like Jasmine: search "Jasmine" → see her one Elite row → done. If there ever were two, you'd see both side-by-side and delete the wrong one in one click.

### B. Person-centric default view

Today Pipeline mixes bookings and runs. Switch the default tab to **Journeys** — one card per person, expandable to show all their bookings + runs + sales in a vertical timeline. Inside the card, each sale has a visible Delete button (uses the existing `DeleteSaleDialog` logic — soft-delete for intro runs, hard-delete for outside sales).

### C. Reduce visual noise

- Drop the 4-stat summary strip (Showing / Purchased / Active / Issues) into a single compact line.
- Collapse the "Add Booking / Fix N / Refresh" header buttons into an overflow menu except for the active one.
- Remove the New Leads, VIP Class, VIP Scheduler tabs from Pipeline — those already live on Leads and VIPs pages. Pipeline becomes purely: **Journeys · Sales · Issues**.

### D. Make destructive actions obvious but safe

- Move Delete out of the kebab menu into a visible red icon on hover for sales/bookings.
- Keep the "type DELETE to confirm" guard. Add a one-line preview of what will be removed (e.g. "Elite sale · $6 commission · 5/28").
- Show an audit footer on each deletion confirming who/when (already partially logged via `last_edited_by`).

### E. Search that actually works

Promote the search box to the top of the page, full-width, with autocomplete on member name. Today it's buried inside the filter bar.

---

## Files that would change

- `src/components/dashboard/CoachAttributionDrillDown.tsx` — dedupe Close rows by underlying sale
- `src/features/pipeline/PipelinePage.tsx` — restructure tabs (Journeys · Sales · Issues), simplify header
- `src/features/pipeline/components/PipelineFiltersBar.tsx` — promote search, drop removed tabs
- `src/features/pipeline/components/PipelineSalesTab.tsx` *(new)* — flat sales list with inline edit/delete
- `src/features/pipeline/components/PipelineSpreadsheet.tsx` — surface Delete as visible icon, trim summary strip
- `src/features/pipeline/usePipelineData.ts` — add `sales` selector joining intros_run SALE + sales_outside_intro

No DB migrations needed. All delete plumbing already exists.

---

## Want me to do all of this, or pick a subset?

The fastest path to unblock your immediate Jasmine problem is **Part 1 (dedupe) + Part 2A (Sales tab)**. The rest is polish that you can stage. Tell me which slice to build and I'll switch to build mode.

&nbsp;

&nbsp;

Build it all and 