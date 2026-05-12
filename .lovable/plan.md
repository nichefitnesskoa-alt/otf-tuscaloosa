## Own It page — simplify and open up the live discussion

### 1. Delete the standalone "Owners" status grid
Remove the "Owners (N)" card with the colored health dots and Locked-in / Not yet badges. The "What the Owners brought" card already shows every owner, their lane, and whether they locked in (or "Not locked in yet"). One source of truth, less visual noise.

### 2. Collapse the Ownership Lane card once a lane is picked
- If the user already holds at least one lane, the "Your Ownership Lanes" card renders collapsed by default with a header showing each lane name.
- A chevron on the header expands it to edit / add / remove lanes.
- Empty state (no lane yet) stays expanded so they're prompted to pick one.

### 3. Collapse the "Your update" card once locked in
- Each `OwnerEntryForm` card auto-collapses after the user hits Lock in my update (or when the entry is already submitted on load).
- Collapsed header shows lane name + green "Locked in" badge + chevron.
- Tapping the chevron expands so they can edit; saving stays inline (no re-collapse on every blur).
- Unsubmitted cards stay expanded.

### 4. Rename + broaden "What the Owners brought"
- Rename "What other Owners brought" → "What the Owners brought".
- Include the viewer's own locked-in entries in the list so it's the single at-a-glance roster for everyone.
- Stays in its current position (just above Live discussion).

### 5. Live discussion: explanation + everyone sees everything
- Replace the single-owner carousel with a stacked layout: one card per submitted owner, each showing their four answers and the full Build / Flag / Offer feed underneath.
- Anyone can add a Build / Flag / Offer to any owner's card (not just Admin / not gated to a single active owner).
- Add a small legend at the top of the Live discussion section:
  - **Build** — add to the idea, push it forward.
  - **Flag** — name a risk or concern.
  - **Offer** — commit to do something about it.
- Remove `activeOwnerIdx` carousel state and the Admin-only Prev / Next chevrons (no longer needed).

### Files to change
- `src/pages/TheTable.tsx` — delete owner grid, collapse states for lane card and OwnerEntryForm card, rename + broaden peer entries, rebuild liveView as stacked-per-owner with legend, drop carousel state.

### Verification
- Owner status grid is gone; "What the Owners brought" lists every active owner with locked / not locked state.
- Picking a lane collapses the lane card; chevron re-opens it.
- Locking in an update collapses that lane's update card; chevron re-opens it.
- Live discussion shows every submitted owner stacked with their own response feed; any signed-in staff can post Build / Flag / Offer on any owner.
- Legend renders above the live discussion explaining Build, Flag, Offer.
- Past, current, and future weeks all use the same layout.