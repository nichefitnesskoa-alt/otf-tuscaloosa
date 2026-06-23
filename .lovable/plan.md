## What's actually broken

I traced every layer. The DB and API are correct, the UI is not:

```
DB (verified via psql):
  Turbo Coffee event_id = 84ab9a09-…
  Bookings with event_id=Turbo Coffee, deleted_at IS NULL:
    - Lia Jacques       NOT_INTERESTED  6/20
    - Christian Kazoleas NOT_INTERESTED  6/20
    - Emma Hensley       ACTIVE          6/17
    - Anna Pauley        SECOND_INTRO_SCHEDULED 6/?
PostgREST (verified via curl with anon key):
  Returns all 4 rows including the intros_run embed.
UI (Admin → Events Index + Event Cohort):
  Shows 0 booked / 0 showed / 0 no-show / 0 bought
  Shows "Nobody tagged to this event yet."
```

The data is there. The two admin queries never see it because nothing refetches them when an intros_booked row is created or its `event_id` is set:

- `src/components/admin/EventCohortPanel.tsx` → query key `['event-cohort', eventId]`
- `src/components/admin/EventsIndexPanel.tsx` → query key `['event-cohort', 'all-tagged']`

Search for `event-cohort` across `src/` returns only those two files. No invalidation, no realtime, no `refetchOnMount`. So once the panel renders an empty result (admin page opened before the bookings were tagged in Pipeline), it stays empty for the whole session. A hard reload fixes it — which is exactly why the data looks "disconnected at the root" from the cohort even though `event_id` is set correctly on every row.

## The fix — one canonical refresh path for everything event-tagged

1. **Always refetch on mount.** Add `refetchOnMount: 'always'` and `staleTime: 0` to both queries in `EventCohortPanel.tsx` and `EventsIndexPanel.tsx`. Opening the Admin tab will always pull fresh data even if the cache was populated earlier in the session.

2. **Realtime invalidation on `intros_booked`.** Add a small hook (or inline `useEffect`) in each panel that subscribes to `postgres_changes` on `public.intros_booked` (event=`*`) and calls `queryClient.invalidateQueries({ queryKey: ['event-cohort'] })` on any change. That covers: new event-tagged booking created in Pipeline, an existing booking's `event_id` changed, outcome changes that flip `booking_status_canon`, and soft-deletes. One subscription per panel; no debouncing needed because the panels are admin-only.

3. **Pipeline creation already writes `event_id` correctly** (`PipelineDialogs.tsx:826`) and the row appears in the DB the moment the insert returns. Once step 2 lands, the cohort updates without a reload.

4. **Conversion funnel sanity-check.** The "Event 4 / 2 / 0" row in screenshot 2 (Pipeline → By Source) reflects journey-level grouping, not the cohort panel. That number is consistent with the studio policy already encoded in `src/lib/canon/introRules.ts` (NON_RAN_RESULT_CANONS includes `NOT_INTERESTED` — see lines 45–47: *"per studio policy, Showed Up – Not Interested does not count as a ran intro"*). So Lia + Christian render in the per-source row drilldown but do not increment "Showed". This is **not** part of this fix — flagging it here only because the user mentioned "they showed up for their intro class." If you want NOT_INTERESTED to count as a ran/showed intro, that's a separate, bigger change (affects WIG ran counts, close-rate denominators, per-coach + per-SA, and the studio scoreboard) and I'll plan it separately on request.

## Files touched

- `src/components/admin/EventCohortPanel.tsx` — add `refetchOnMount: 'always'`, `staleTime: 0`, and a realtime subscription on `intros_booked` that invalidates `['event-cohort']`.
- `src/components/admin/EventsIndexPanel.tsx` — same treatment for the `['event-cohort','all-tagged']` query.

No DB migrations. No business-logic changes. No canon changes.

## Coherence verification (what I'll prove after the change)

```
Pipeline → By Source → Event row → Total Booked = 4 (Kyla, Lia, Christian, Emma)
Admin → Events Index → Turbo Coffee row = 3 booked / 1 showed / 1 no-show / 0 bought
   (Kyla is tagged to "Tuscaloosa 5k", not Turbo Coffee)
Admin → Event Cohort (Turbo Coffee selected) = same 3 rows listed
   Lia + Christian render with status "Booked" (booking_status_canon NOT_INTERESTED → falls through showedLabel default), Emma "No-show", Anna "Booked" (SECOND_INTRO_SCHEDULED)
After hitting "Create Event Booking" in Pipeline → cohort tile increments without reload
```

## Open question I will NOT assume

The "Showed" tile in the cohort panel currently keys off `booking_status_canon === 'SHOWED'`. Your real data uses richer canon values (`NOT_INTERESTED`, `SECOND_INTRO_SCHEDULED`) that semantically mean "showed up and ran the intro." If you want the Showed tile + Showed badge to count any ran outcome (use `didIntroActuallyRun` on `intros_run` instead of the booking canon), say "yes count ran intros as showed" and I'll roll that into the same build. Otherwise the tile stays accurate to its current literal definition.
