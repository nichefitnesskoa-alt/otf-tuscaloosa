## Add Giveaways section to Admin Panel

Today, the giveaway admin surfaces (`/admin/:studioSlug`, `/admin/:studioSlug/preview`, `/admin/:studioSlug/partner-deck`, `/admin/:studioSlug/partner-view`) are only reachable by typing the URL. This adds a single jump-off point inside `/admin` that lists every studio and exposes all four admin links per location.

### Scope

One new tab in `src/pages/Admin.tsx`: **Giveaways**. Admin-only (already gated by the page).

### What it shows

For each of the 4 studios in `giveaway_studios` (Tuscaloosa, Auburn, Montgomery, Vestavia Hills), one card with the studio's admin name (via `getAdminStudioName(slug)`) and four buttons:

- **Admin** → `/admin/{slug}` (entries, draw, settings)
- **Preview** → `/admin/{slug}/preview` (participant view)
- **Partner Deck (Admin)** → `/admin/{slug}/partner-deck`
- **Partner View** → `/admin/{slug}/partner-view`

Each button opens in a new tab (`target="_blank"`) so the operator keeps the admin panel open while reviewing.

### Implementation

1. `src/pages/Admin.tsx`
   - Add `{ value: 'giveaways', label: 'Giveaways', icon: <Gift className="w-4 h-4" /> }` to `adminSections`.
   - Add a `<TabsContent value="giveaways">` block rendering a new `GiveawaysAdminTab` component.
2. New component `src/components/admin/GiveawaysAdminTab.tsx`
   - Fetches `giveaway_studios` (`select studio_slug` ordered by `studio_slug`) via Supabase on mount, with React Query.
   - Renders one card per studio using `getAdminStudioName` from `src/lib/studioNames.ts`.
   - Buttons use existing shadcn `Button` with `variant="outline"`, 44px min height, icons (`Users`, `Eye`, `Presentation`, `ExternalLink`), full readable labels.
   - Empty/loading/error states inline (skeleton row, friendly message).

No DB changes, no route changes, no role changes. The four giveaway routes already exist in `App.tsx`.

### Verification

- As Koa, open `/admin` → Giveaways tab shows 4 studio cards.
- Each of the 16 buttons opens the correct route in a new tab.
- Non-admin roles still get redirected away from `/admin` (existing guard).
- Studio list reflects whatever is in `giveaway_studios` (no hardcoded slugs).
