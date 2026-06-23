REACH MAP for event cohort/showed counting
- Tables touched: `events`, `intros_booked`, `intros_run`.
- Hooks/queries that read these tables: `useEvents`, `EventCohortPanel.useCohort`, `EventsIndexPanel.useAllEventTaggedBookings`, WIG lead/booking hooks that read intro attribution.
- Components that display this data: Admin Events index, Admin Event Cohort, Person Journey drawer, WIG/event-derived self-generated lead counts.
- Metrics/helpers derived from this data: event booked/showed/no-show/bought totals, close detection via `isCloseRun`, intro attendance/showed logic.
- React Query keys: `['events']`, `['event-cohort', eventId]`, `['event-cohort', 'all-tagged']`, WIG lead keys touched by event/VIP attribution.
- Cross-page surfaces affected: Admin Events, Event Cohort, WIG self-generated leads, Pipeline tagging/outcome writes.
- DB triggers: existing intro booking/run change triggers and realtime publication on `intros_booked` + `intros_run`.

Root cause found
- The Events queries are failing in the browser because they request `intros_run.membership_type`, but that column does not exist. React Query falls back to empty arrays, so the UI shows `0 booked` even though the database has 4 Turbo Coffee rows.
- Turbo Coffee has 4 non-deleted bookings in the database: Emma Hensley, Anna Pauley, Christian Kazoleas, Lia Jacques.
- Current showed counting only checks `booking_status_canon === 'SHOWED'`, so `NOT_INTERESTED` and `SECOND_INTRO_SCHEDULED` are excluded even though they showed up.

Plan
1. Remove the bad `membership_type` field from both Admin Event queries so tagged bookings load again.
2. Add one canonical event attendance helper, for Events only, that counts showed as:
   - `booking_status_canon = SHOWED`
   - `booking_status_canon = NOT_INTERESTED`
   - `booking_status_canon = SECOND_INTRO_SCHEDULED`
   - matching run outcomes that mean the person attended, including `NOT_INTERESTED` and `SECOND_INTRO_SCHEDULED`
3. Update both Admin Event surfaces to use that helper for the showed tile and row badge, so All Events and the selected Event Cohort agree.
4. Keep no-show and bought logic unchanged, except they will work again once the query stops failing.
5. Verify with real data:
   - Turbo Coffee loads 4 booked.
   - Turbo Coffee counts 3 showed: Anna, Christian, Lia.
   - Emma remains booked/no-show according to the current booking/run data.
   - Admin Events index and Event Cohort show the same numbers.
6. Check WIG/event self-generated lead connection after the Events fix and include any needed query invalidation or attribution alignment if the same broken event query is reused there.

COHERENCE PROOF target after implementation
- DB verification: Turbo Coffee event row and all 4 linked `intros_booked` rows named.
- Cross-page check: Admin Events row and Event Cohort panel show the same booked/showed/no-show/bought totals; WIG event/self-generated lead count checked against the same rows.
- Files expected: `src/components/admin/EventCohortPanel.tsx`, `src/components/admin/EventsIndexPanel.tsx`, plus a small canonical helper if no existing event helper exists.