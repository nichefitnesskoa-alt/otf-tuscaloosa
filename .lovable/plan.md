

# Add Studio Scoreboard to Studio Page + Clean Up Admin

## Two changes needed:

### 1. Add StudioScoreboard component to Studio page (`src/pages/Recaps.tsx`)

The page has the title "Studio Scoreboard" but never renders the actual `<StudioScoreboard>` component. Need to:

- Import `StudioScoreboard` from `@/components/dashboard/StudioScoreboard`
- Compute the metrics it needs (introsRun, introSales, closingRate, qCompletionRate, prepRate, introsBooked, introsShowed, noShows) from the existing `metrics` object and `useQAndPrepRates` logic
- Render `<StudioScoreboard ... />` right after the filters row and before `<LeadMeasuresTable>`
- Import `useEffect, useState` and `supabase` for the Q/Prep rate queries (reuse the pattern from the old `MyDayTopPanel`)

### 2. Remove sections from Admin Overview (`src/components/admin/AdminOverviewHealth.tsx`)

Remove these sections entirely:
- **AMC Trend** card (lines 152-193)
- **Net Member Change** card (lines 196-218)
- **Lead Source → Member Conversion** card (lines 221-245)

Keep: Referral Discount Liability card and System Health card. Also remove the now-unused state/data fetches for `amcEntries`, `leadSourceData`, `weeklyGains` and related chart imports.

### 3. Remove sections from Admin Coaching (`src/components/admin/CoachingView.tsx`)

Remove these sections:
- **Close Rate (showed) vs Goal/Why Capture** scatter chart (lines 257-280)
- **Close Rate (showed) by SA** bar chart (lines 282-306)
- **2nd Intro Conversion** table (lines 308-336)
- **Lead Measures by SA** table (lines 338-376)

Keep: Date filter, Objection Distribution, Coaching Suggestions, Outreach Effectiveness, Follow-Up Digest.

Also remove the `goalWhyRate`, `friendRate`, `secondIntro*` fields from the data computation since they're no longer displayed, and remove the coaching suggestions that reference them.

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Recaps.tsx` | Add `<StudioScoreboard>` with metrics, add Q/Prep rate computation |
| `src/components/admin/AdminOverviewHealth.tsx` | Remove AMC Trend, Net Member Change, Lead Source Conversion cards and related data |
| `src/components/admin/CoachingView.tsx` | Remove Close Rate vs Goal/Why, Close Rate by SA, 2nd Intro Conversion, Lead Measures by SA sections |

