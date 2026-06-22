## Goal

Make the desktop **entry gate** (the screen before someone drops their contact info) feel as complete as the mobile/post-entry experience. Today it's just a small form floating in a sea of black; the participant has no idea what they could win or how much time is left until *after* they hand over their info.

## Change scope

Frontend only. Single file: `src/features/giveaway/components/GiveawayEntryForm.tsx`. No DB, no hooks, no routing, no admin changes.

## What gets added to the gate (stacked, centered, ~880px max width)

In order, top to bottom:

1. **Title** — keep existing `FitText` headline on desktop, `MobileStackedTitle` on mobile (unchanged).
2. **Presented by** subline — same `Presented by …` line used in `EntryActions` (line 449-452 of the file).
3. **Intro copy** — the existing "Drop your info to unlock entry actions…" line.
4. **Countdown** — `<Countdown targetIso={...} label="Closes in" />` when `endAt` exists. Centered.
5. **"What you could win" prize grid** — reuse `<PrizeShowcase slug={...} partners={...} showWinnerBadge={ef.showWinnerBadgeOnCards} />` exactly as `EntryActions` uses it, plus the same orange banner (`ef.bannerText`) and `ef.winnerRuleStatement` line below it.
6. **First time / Coming back tab toggle + form card** — unchanged behavior, just centered in the same 880px column.

Mobile keeps the same stacked flow — countdown and prize grid simply appear above the form (mobile already stacks everything, so no separate mobile layout work needed).

## Layout container

- Bump the gate's outer wrapper from `max-w-[760px]` to `max-w-[880px]` so the prize grid breathes on desktop without overwhelming the form.
- Keep `mx-auto px-4 md:px-12 py-6 md:py-10`.
- Center the tab pills and the form card (the pills are currently `inline-flex`; wrap in a `flex justify-center` so they sit centered under the prize grid).

## Code touchpoints

- `EntryGate` component (lines ~186-321): add the countdown + prize framing block between the intro paragraph (line 250) and the tab pills (line 253). Pull `endAt`, `studio`, `partners`, `coBrandParts` in as new props from the parent call site (lines 145-159).
- Parent call site (the `if (!previewMode && !entry)` block, lines 141-161): pass `endAt`, `studio`, `partners`, `coBrandParts` down.
- Reuse the exact same `getEntryFormPrizeFraming(studio.winner_structure ?? 'single')` IIFE pattern already used in `EntryActions` (lines 488-500) so framing/banner copy stays in sync between gate and post-entry views.
- No changes to `PrizeShowcase`, `Countdown`, `FitText`, `MobileStackedTitle`, or any data hook.

## Out of scope

- Post-entry `EntryActions` screen — already looks right.
- Admin pages, `/admin` link block from prior turn — untouched.
- No new colors, fonts, brand tokens, or design tokens. Existing OTF brand colors (`#E8540A`, `#1C1C1E`, `#F5F2EE`) only.
- No backend / DB / RLS / migration work.

## Verification before closing

This is a pure presentation change with no shared data or attribution logic touched, so no DB coherence proof applies. Verification will be:

- Visual check at 1280px desktop viewport: gate shows countdown + prize grid + form, all centered, no horizontal overflow.
- Visual check at mobile viewport (375px): same content stacks cleanly; mobile title still uses `MobileStackedTitle`.
- Confirm `/giveaway/tuscaloosa` (live, no entry cookie) renders the new gate, and once an entry exists the post-entry view is unchanged.
