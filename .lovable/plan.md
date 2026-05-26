## Fix: share the public partner deck URL, not the admin editor

### What's happening
The Giveaways tab in Admin currently exposes `/admin/{slug}/partner-deck`, which is the **editor** for the deck. Sharing that link forces recipients through a sign-in flow. There's already a separate public route — `/partner-deck/{slug}` (rendered by `PartnerDeckPage.tsx`) — that has no auth and is designed for partners.

### Fix
Restructure the Giveaways card in `src/components/admin/GiveawaysAdminTab.tsx` so the share link and the editor are clearly separated:

For each studio, show:
1. **Admin (Entries & Draw)** → `/admin/{slug}` (opens in new tab)
2. **Participant Preview** → `/admin/{slug}/preview` (opens in new tab)
3. **Edit Partner Deck** → `/admin/{slug}/partner-deck` (opens in new tab) — internal editor
4. **Partner Deck — Share Link** row with two side-by-side buttons:
   - **Open** → `/partner-deck/{slug}` (opens in new tab, public route)
   - **Copy link** → copies the absolute URL `${window.location.origin}/partner-deck/{slug}` to clipboard, shows "Copied" toast via existing sonner
5. **Partner Dashboard** → `/admin/{slug}/partner-view` (opens in new tab) — keep as-is; this is the live entries tracker partners can also view

Use the existing `toast` from `sonner`. Buttons keep 44px min height and full readable labels. Helper text under the card clarifies: "Share the Partner Deck link with partners — no login required."

### Files
- `src/components/admin/GiveawaysAdminTab.tsx` — restructure buttons, add copy-to-clipboard action.

No DB changes, no route changes. The public route already exists in `App.tsx` (`/partner-deck/:studioSlug`).

### Verification
- Open `/admin` → Giveaways tab → click **Copy link** for Auburn → paste in incognito → loads the partner deck with no sign-in prompt.
- Click **Open** → new tab loads `/partner-deck/auburn` directly.
- **Edit Partner Deck** still opens the admin editor for Koa.
