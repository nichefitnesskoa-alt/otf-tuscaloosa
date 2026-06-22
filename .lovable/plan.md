## Surface the giveaway entry link in Admin → Giveaways

The link `https://otf-tuscaloosa.lovable.app/giveaway/<studio>` already works — it just isn't easy to grab from the admin card. I'll add it right next to the partner-deck share link so it's one tap to copy or open.

### What you'll see

In each studio card on `/admin` → Giveaways tab, under the existing orange "Partner Deck — Share Link" block, a new green-accented block:

```text
┌─ GIVEAWAY ENTRY — PARTICIPANT LINK ─────────┐
│ https://otf-tuscaloosa.lovable.app/         │
│   giveaway/tuscaloosa                       │
│ [ Copy link ]   [ Open ]                    │
└─────────────────────────────────────────────┘
```

- Pulled directly from the studio's `studio_slug` — no new field to edit, no migration.
- Same copy / open behavior as the partner-deck block.
- Uses a different color (green) so it's visually distinct from the partner-pitch link and impossible to confuse.

### Technical detail

Single edit to `src/components/admin/GiveawaysAdminTab.tsx`:
- Add `const entryUrl = `${PUBLIC_ORIGIN}/giveaway/${slug}`;` next to the existing `publicUrl`.
- Render a second block above the internal-tools list with the URL display + Copy/Open buttons, mirroring the partner-deck block's structure.

No database changes, no routing changes, no entry form changes.
