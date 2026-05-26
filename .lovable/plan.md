## Custom short share link per studio

### Goal
Replace `/partner-deck/{slug}` with a custom, editable, root-level link per studio — e.g. `otf-tuscaloosa.lovable.app/OTF-AUBURN-PARTNER`. Editable from the Giveaways tab. Each studio has its own.

### DB change (migration)
Add a column to `giveaway_studios`:
- `share_slug TEXT` — nullable, case-insensitive unique.
- Unique index on `lower(share_slug)` to prevent collisions.

Seed defaults for the existing 4 studios:
- `tuscaloosa` → `OTF-TUSCALOOSA-PARTNER`
- `auburn` → `OTF-AUBURN-PARTNER`
- `montgomery` → `OTF-MONTGOMERY-PARTNER`
- `vestavia` → `OTF-VESTAVIA-PARTNER`

### Routing (`src/App.tsx`)
Add a single catch-all root route **immediately before** `<Route path="*" element={<NotFound />}>`:

```tsx
<Route path="/:shareSlug" element={<PartnerDeckShareResolver />} />
```

New component `src/features/giveaway/PartnerDeckShareResolver.tsx`:
- Reads `shareSlug` from the URL.
- Hard-rejects (renders `<NotFound />`) any slug in a reserved list (matches every existing top-level route: `my-day`, `coach-view`, `recaps`, `wig`, `the-table`, `vips`, `my-intros`, `pipeline`, `admin`, `login`, `scripts`, `settings`, `meeting`, `q`, `story`, `vip-register`, `vip-availability`, `vip`, `apply`, `join-the-team`, `giveaway`, `partner-deck`, `questionnaire`, `scorecards`, `coaches`, `sas`, `dashboard`, `my-shifts`, `shift-recap`, `reports`, `leads`).
- Queries `giveaway_studios` by `share_slug ILIKE :shareSlug`. If found, renders the existing `PartnerDeckPage` with that studio's `studio_slug` injected (refactor `PartnerDeckPage` to accept an optional `studioSlug` prop and fall back to `useParams`).
- If not found, renders `<NotFound />`.

Existing `/partner-deck/:studioSlug` route stays (backward compatibility for old shares).

### Admin UI (`src/components/admin/GiveawaysAdminTab.tsx`)
In each studio card, add at the top of the "Share Link" block:
- **Custom share link** label.
- A single-line input pre-filled with `share_slug`. Auto-uppercases on input; restricts to `[A-Z0-9-]`; max length 40.
- Inline "Saved" indicator after blur; saves to `giveaway_studios.share_slug` (insert tool / SDK `.update`). Reject save if the slug is empty, reserved, or already taken (catch unique-violation → toast "That link is already taken").
- Computed full URL displayed below: `${origin}/${share_slug}`.
- **Copy link** and **Open** buttons now use the custom URL.

Add a small helper line: "Letters, numbers, and hyphens only. The link is case-insensitive."

### Files
- Migration: add `share_slug` column + unique index.
- Data update: seed default `share_slug` for the 4 existing rows.
- `src/App.tsx` — add the catch-all route.
- `src/features/giveaway/PartnerDeckShareResolver.tsx` — new.
- `src/features/giveaway/PartnerDeckPage.tsx` — accept optional `studioSlug` prop.
- `src/components/admin/GiveawaysAdminTab.tsx` — editable slug input + use custom URL.

### Verification
- Visit `otf-tuscaloosa.lovable.app/OTF-AUBURN-PARTNER` in incognito → loads Auburn partner deck, no sign-in.
- Visit `otf-tuscaloosa.lovable.app/admin` → still loads the admin page (reserved slug not intercepted).
- Visit `otf-tuscaloosa.lovable.app/nonsense-xyz` → 404.
- Edit Auburn's slug to `AUBURN-OPEN-HOUSE` in Giveaways tab → old `OTF-AUBURN-PARTNER` URL 404s, new URL works.
- Attempt to set the same slug on two studios → toast error, no save.
- Legacy `/partner-deck/auburn` still works.
