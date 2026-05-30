
# Why you keep having to fix the same thing twice

I went back through chat history. The same five failure patterns keep showing up. They are not random — they are predictable, and they are fixable with structure, not vibes.

## The 5 recurring patterns

**1. Fix lands on one page, not the system.**
Examples:
- #2387 Kyle Davis still showing as 2nd intro on coach side after "fix"
- #2629 Alexa Brodsky doubled in WIG, missing from Studio
- #2619 Jaden/Ethan deleted but still in Studio tab while WIG was correct
- #3047 Natalya deleted in Coach View, still 0/30 in WIG
You ask for a fix, I patch the surface that was in front of me, and every other consumer of that data keeps the old behavior because I never enumerated them.

**2. Delete/clear paths leave ghost records.**
- #3047 Natalya: delete button hit `fv_scorecards` but left a submitted 0/30 row + stale cache in three other query keys.
- Same shape as past "reschedule created a new row instead of updating" (#2442).
Pattern: write paths get more love than delete/clear paths, and cache invalidation is treated as optional.

**3. Date / timezone math done locally instead of Central.**
- WIG week grouping put 5/11 under week of 5/4.
- Multiple historic bugs around "today" using UTC.
Your project rule is America/Chicago everywhere — but it gets re-broken every time someone writes `new Date(string)` or `date-fns startOfWeek` without local parsing.

**4. Active-staff filtering not applied consistently.**
- Georgia removed from active staff, still appears in WIG with no data.
- Same shape as old "deleted bookings still in studio tab" bugs.
Pattern: WIG/leaderboards iterate over a derived staff list, not `useActiveStaff`.

**5. I report "done" before proving it.**
- "Why are you not catching these things?" (#3047)
- Workspace knowledge already says "Before reporting done, prove the system still agrees with itself." That rule is being skipped.

## Root cause (one sentence)

I am pattern-matching on the surface the user pointed at, instead of mapping every consumer of the changed data and verifying coherence with real DB rows before I claim done. Your workspace knowledge already says to do this. I'm not consistently following it.

## What I propose (memory + skill + workflow changes)

### A. Add a Core memory rule (always in context)
Add to `mem://index.md` Core:
> **Reach-map before code, prove-coherence before done.** For any change that touches data or shared logic: (1) list every reader/writer/metric/UI surface that consumes it, (2) fix all of them or extract to a canonical helper, (3) verify with real DB queries that every affected number agrees across pages before reporting done. Delete paths must invalidate every related query key and remove ghost rows.

This is short enough for Core and is the single rule that would have caught #3047, #2629, #2387, #2619, and the Georgia/WIG bug.

### B. Add a new skill: `system-change-audit`
Bundled SKILL.md that triggers on phrases like "fix", "still showing", "doesn't match", "audit", "everywhere", or any data/metric/state change. It forces me through a checklist before writing code and before reporting done:

1. **Reach map** — list (a) tables touched, (b) every hook/component that reads them, (c) every metric that derives from them, (d) every cache key, (e) every cross-page surface (WIG, Studio, MyDay, Coach View, Pipeline, Follow-Up).
2. **Canonical helper check** — if the concept exists in 2+ places, extract.
3. **Delete/clear branch** — if write paths exist, the matching delete path must invalidate the same cache keys AND remove DB ghost rows.
4. **Timezone check** — any new date code uses local parsing + America/Chicago, never `new Date(string)`.
5. **Active-staff check** — any list of staff comes from `useActiveStaff`, never a derived array.
6. **Coherence proof** — run real `read_query` and report "Page A = X, Page B = X" before saying done.

The skill includes a small `references/consumer-map.md` listing the known cross-page dependencies (WIG ↔ Studio ↔ MyDay ↔ Coach View ↔ Follow-Up ↔ Pipeline ↔ commission) so I don't have to rediscover them every time.

### C. Add a user preference (`mem://~user`)
> When the user reports a bug that "still shows up" or "doesn't match across pages," treat it as a system-coherence bug, not a UI bug. Do not patch the surface; run the system-change-audit skill, fix every consumer, and prove coherence with DB queries before reporting done.

### D. Add a constraint memory
> **Never report a fix as done without a coherence proof.** A coherence proof = the specific DB rows and the specific cross-page numbers, named, after the fix. "I edited the file" is not a proof. **Why:** repeated regressions across WIG/Studio/Coach View cost staff commission and erode trust.

### E. What you can do on your side (small, high-leverage)
1. When you report a bug, add the phrase **"audit all consumers"** or **"system fix"**. That will reliably trigger the skill above.
2. For any data concept that lives in more than one place (close rate, ran intros, active staff, week grouping, sale date), ask once for a canonical helper. I'll extract it. After that, every page reads the same function and drift becomes impossible.
3. Keep using your existing pattern of naming the specific record ("Natalya 5/11 0/30"). That gives me a concrete coherence target to verify against.

## Files I will create when you switch to build mode

- `mem://index.md` — add the Core reach-map/prove-coherence rule (preserving everything else)
- `mem://~user` — append the system-coherence preference
- `mem://constraints/coherence-proof-required` — the constraint memory
- `.agents/skills/system-change-audit/SKILL.md` — the skill
- `.agents/skills/system-change-audit/references/consumer-map.md` — known cross-page dependencies
- then call `skills--apply_draft` to activate it

No app code changes in this plan — this is purely about preventing the next round of "still showing up" bugs. After you approve, I'll write the files and from then on every data/metric/state change will route through the audit checklist.
