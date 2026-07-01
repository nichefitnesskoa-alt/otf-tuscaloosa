## Goal
Change the giveaway drawing flow so:
1. Every submitted entry is eligible (drop the Instagram-follow requirement — we verify in person).
2. Prizes are awarded first-come-first-serve: the first person spun picks first, second picks from what's left, etc.
3. After a spin, an admin can disqualify the winner (e.g. verified they don't actually follow all accounts) and re-spin for that slot.

## Reach map
Files that gate on `action_instagram_follow` or drive the draw:
- `src/features/giveaway/GiveawayAdminPage.tsx` — totals, `eligibleCount`, `drawEntries`
- `src/features/giveaway/components/DrawWinner.tsx` — per-prize draw
- `src/features/giveaway/components/SpinWheel.tsx` — spin + per-prize selector
- `src/features/giveaway/lib/weightedDraw.ts` — filter helpers (already gated on the flag — needs to stop)
- `src/features/giveaway/components/EntriesTable.tsx` — displays eligibility badge
- `src/features/giveaway/components/GiveawayEntryForm.tsx` — required checkbox
- `src/features/giveaway/lib/winnerStructure.ts` — rule statement copy

## Changes

### 1. Eligibility = submitted
- `weightedDraw.ts`: remove `action_instagram_follow` filter from `drawWinner` / `topWeightedForWheel`. Only exclude zero-entry rows (all submissions have base_entries=1, so effectively "submitted = in").
- `GiveawayAdminPage.tsx`: `totalPool` and `eligibleCount` count every entry (no follow gate). Update helper copy to "All submissions eligible — verify follows in person."
- `GiveawayEntryForm.tsx`: keep the "follow all accounts" checkboxes as encouraged actions for bonus entries, but make the IG-follow checkbox NOT required to submit. Add small note: "We verify in person at the drawing."
- `EntriesTable.tsx`: replace "Ineligible (no IG follow)" state with a neutral "Follows unverified" indicator so staff know to check at the event.

### 2. First-come-first-serve pick order (Spin Wheel becomes primary)
Rework `SpinWheel.tsx` per-prize mode into "pick order" mode:
- Remove the "Spinning for [prize dropdown]" selector.
- Maintain an ordered `awarded[]` list of `{winner, prizeId|null, disqualified:false}` and a `remainingPrizes[]` list.
- Flow per spin:
  1. Admin taps SPIN → wheel picks a winner from remaining eligible pool.
  2. Winner reveal shows remaining prizes as tap-to-award buttons. Admin taps the prize the winner chose → it's locked to that winner and removed from `remainingPrizes`.
  3. Winner auto-removed from wheel; SPIN button re-enables until `remainingPrizes` is empty.
- Below the wheel, show a live "Pick order" list: `1. Jane → Free class at Session Yoga`, `2. Mike → Membership`, etc., with a `Disqualify & re-spin` button on each row.

### 3. Disqualify & re-spin
- Clicking `Disqualify` on a row: marks that award disqualified, returns the prize to `remainingPrizes`, adds the person to a `disqualified` set so they can't be re-picked, and prompts the admin to SPIN again for that prize slot. New winner then picks (but since only one prize is back on the table, it auto-assigns to that prize with confirmation).
- Add "Undo disqualification" for accidental clicks (returns them to pool, removes the newly-awarded slot if one exists yet).

### 4. Drop the legacy DrawWinner card
- `DrawWinner.tsx` duplicates the flow and is confusing next to the wheel. Remove its render from `GiveawayAdminPage.tsx` (keep the file until confirmed unused). Spin wheel is the single source of truth for awarding.

### 5. Copy updates
- `winnerStructure.ts` `getDrawRuleStatement`: append "Winners pick prizes in the order they're spun. Follow verification happens in person."
- Admin header helper text: "First person spun picks first. Disqualify and re-spin any winner who doesn't pass in-person verification."

## Technical notes
- State lives in `SpinWheel` local state; nothing persisted to DB (matches current behavior — the draw is a live event tool).
- No schema changes.
- No changes to entry submission validation on the server; only the client form requirement is dropped.

## COHERENCE PROOF (to be produced at build time)
- DB: `select count(*) from giveaway_entries where studio_slug = <active>` = number shown in admin "eligible" count.
- Cross-page: Admin `Entries` count == wheel pool count == CSV row count == public entry count.
- Verify: after disqualifying, prize returns to remaining list AND the person disappears from the wheel on next spin.
