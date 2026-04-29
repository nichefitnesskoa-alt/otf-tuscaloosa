## Goal
On the coach's **My Intros** cards, clearly show which visit type each card represents:
- **1st Intro** — standard first visit
- **2nd Intro** — booked after a previous intro
- **VIP Class** — they only attended a VIP class (synthetic VIP row)
- **VIP → 1st Intro** / **VIP → 2nd Intro** — they attended a VIP class with this coach AND have a real intro booking

## Scope
Single file: `src/pages/CoachMyIntros.tsx`. No schema changes, no new queries — we already have the data.

## Detection logic (computed during merge)

Add a `visitType` field to `MergedIntro`:

1. **Synthetic VIP row** (`bookingId` starts with `vip:`) → `VIP_ONLY`
2. **Real booking** where the person also has a VIP attendance with this coach:
   - Build a Set of normalized names from the already-fetched `vipRegs` (any outcome, not just showed/booked).
   - Actually expand the VIP fetch slightly: pull ALL `vip_registrations` for this coach's `vip_sessions` (drop the `outcome IN (...)` and `booking_id IS NULL` filters into a separate query just for the name set) so we can detect "this person came via VIP" even when their VIP reg is now linked to a booking.
   - If the booking's normalized member name is in that set → `VIP_THEN_SECOND` (when `isSecondIntro` is true) or `VIP_THEN_FIRST`.
3. **Real booking, `isSecondIntro` true** → `SECOND`
4. **Otherwise** → `FIRST`

## Badge rendering

Add `getVisitBadge(visitType)` returning `{ label, color }`:
- `FIRST` → "1st Intro", blue
- `SECOND` → "2nd Intro", indigo
- `VIP_ONLY` → "VIP Class", purple
- `VIP_THEN_FIRST` → "VIP → 1st Intro", fuchsia
- `VIP_THEN_SECOND` → "VIP → 2nd Intro", fuchsia darker

Render the badge inline in the card header next to the existing `statusBadge` (line ~599 area), same pill style, full readable label (no abbreviations, per UX rules).

Also show the same badge in the expanded section near the existing "Outcome:" line so it's visible without collapsing.

## Implementation steps

1. Extend `MergedIntro` type with `visitType` and `visitBadge`.
2. Add `getVisitBadge()` helper next to existing `getStatusBadge()`.
3. In `fetchData`, after fetching `vipRegs` (the showed/booked set), add a second fetch for all VIP regs in the coach's sessions to get the name set:
   ```ts
   const { data: allVipRegs } = await supabase
     .from('vip_registrations')
     .select('first_name, last_name')
     .in('vip_session_id', sessionIds);
   const vipAttendeeNames = new Set(allVipRegs.map(r => norm(`${r.first_name} ${r.last_name}`)));
   ```
4. In the bookings → MergedIntro map, compute `visitType`:
   ```ts
   const isVipAttendee = vipAttendeeNames.has(norm(b.member_name));
   const visitType = isVipAttendee
     ? (isSecondIntro ? 'VIP_THEN_SECOND' : 'VIP_THEN_FIRST')
     : (isSecondIntro ? 'SECOND' : 'FIRST');
   ```
5. In the VIP synthetic merge, set `visitType: 'VIP_ONLY'`.
6. Render `<span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', intro.visitBadge.color)}>{intro.visitBadge.label}</span>` in the card header right after the status badge.
7. Mirror the badge in the expanded "Outcome:" row for redundancy.

## Downstream effects
- Pure additive UI change — no behavior change to filters, sort, dedup, or actions.
- Existing `isSecondIntro` logic unchanged.
- No new tables, RLS, or queries against unfamiliar shapes.
- One extra `vip_registrations` SELECT per page load (small — already scoped to this coach's sessions).

## Done means
- Every card on Coach My Intros shows a visible visit-type badge in the header.
- All five states render with the correct label.
- Existing layout, sort order, and actions unchanged.
