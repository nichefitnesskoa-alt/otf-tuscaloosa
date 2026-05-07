# Public VIP Pages — Confirmation, Social Proof, Share

Scope: only public-facing VIP pages. No internal app changes, no DB schema changes, no business logic changes outside what's listed.

---

## Heads-up before we build

**There is no `/vip/[slug]` group-specific page today.** The only slug routes are `/vip/:slug/register` and `/vip/:slug/roster`. The public claim flow lives entirely on `/vip-availability` (claim happens in a dialog, then today shows an inline confirmation block).

Upgrade D asks for a "Share this class" button on `/vip/[slug]` (the page a group sees from a direct link before claiming). Two options — **CONFIRM**:

- **A.** Skip Upgrade D's `/vip/[slug]` share button. The new `/vip/[slug]/confirmed` page already covers post-claim sharing, and the `/vip/[slug]/register` page covers post-link-receipt sharing (we'll add a Share button there too as part of Upgrade B).
- **B.** Create a new `/vip/[slug]` landing page that shows the reserved class details + a "Share this class" button. Adds a route but matches the prompt literally.

I'll assume **A** unless told otherwise — it preserves current routing and avoids inventing a new page.

---

## Upgrade A — `/vip/[slug]/confirmed` page

New route, public, off-white `#F5F2EE` background, orange `#E8540A` header bar with OTF logo.

**Data load.** Read `vip_sessions` by `shareable_slug`. If not found or `status !== 'reserved'` → redirect to `/vip-availability`.

**Layout (top → bottom):**
1. **Hero**: "You're in." (large bold) + "Here's what happens next." (muted)
2. **Date/time block**: orange-bordered card showing day, full date, time, and `reserved_by_group` if present
3. **Timeline** (4 steps; horizontal on `md+`, vertical stack on mobile):
   - Step 1 "Claim" — filled orange (done state)
   - Step 2 "Share with your group" + subtext
   - Step 3 "Show up 15 min early" + subtext
   - Step 4 "First class free" + subtext
   - Steps 2–4 outlined orange
4. **Share section**:
   - Header + subtext
   - Read-only input with `https://otf-tuscaloosa.lovable.app/vip/[slug]/register`
   - "Copy Link" button → writes to clipboard, label flips to "Copied!" for 2s
   - "Share" button → `navigator.share({ title, text, url })`. If `navigator.share` is undefined, render Copy Link only (no double-render)
5. **QR code** (`qrcode.react` already installed): 180×180, white bg / black fg, 4px orange border. Encodes the **register** URL. Caption "Or scan to register"
6. **Download QR Code** button: client-side canvas composition (mirrors existing logic in `VipAvailability.tsx`). PNG file: `OTF-VIP-[group-slugified]-MMDDYYYY.png`. Image contains QR + "OTF Tuscaloosa — Private Group Class" + "[Date] at [Time]" + "Scan to register before class"
7. **Add to Calendar** row:
   - "Add to Google Calendar" → opens `https://calendar.google.com/calendar/render?action=TEMPLATE&...` in new tab
   - "Add to Apple Calendar" → triggers download of generated `.ics`
   - Both events: title "OTF Tuscaloosa VIP Class", location "OrangeTheory Fitness Tuscaloosa", 60-minute duration, description per spec
   - **DTSTART/DTEND in UTC, converted from America/Chicago.** Use `date-fns-tz` (already in repo if present — confirm) or manual offset; do NOT assume CT = UTC

**Routing change.** Update the existing inline confirmation block in `VipAvailability.tsx` so that, after a successful claim, it navigates to `/vip/[slug]/confirmed` instead of rendering the inline confirmed UI. Old inline confirmed block is removed.

---

## Upgrade B — Social proof on `/vip/[slug]/register`

Above the existing form, add:

- **Group/session header** moved up: large group name + "[Day, Month Date] at [Time]" (currently a small line below "Welcome — Fill Out Your Info Before Class"; consolidate)
- **Social proof pill** (orange, only if count > 0): "[X] from your group have already signed up"
  - Query: `vip_registrations` where `vip_session_id = session.id` AND `is_group_contact = false`
  - Live updates via Supabase Realtime channel on `vip_registrations` (insert/delete) filtered to this session
  - Zero state renders nothing
- Existing form fields below — unchanged

Also add a small "Share this class" Web Share / Copy Link button below the form (covers Upgrade D intent on this page).

---

## Upgrade C — Post-registration confirmation

Replace the current "You're all set, [name]!" success block in `VipMemberRegister.tsx` with:

- Centered, generous line-height, clean sans-serif:
  > "You just did something most people talk about but never do."
- Muted line: "We'll see you on [Day, Month Date]. Come 15 minutes early and we'll get you set up."
- Orange line: "See you there. 🧡"
- No buttons. No links. No nav back to anything.

Header bar (orange + OTF) stays.

---

## Upgrade D — Native share

- Confirmation page (Upgrade A) Share button — covered above
- Register page (Upgrade B) Share button — covered above
- New standalone `/vip/[slug]` page — **skipped pending CONFIRM** (see top)

Detection rule everywhere: `if (navigator.share) render Share else render Copy Link`. Never both at once.

---

## Files

**New:**
- `src/pages/VipConfirmed.tsx` — the `/vip/:slug/confirmed` page
- `src/lib/vip/calendar.ts` — small util: `buildGoogleCalendarUrl(session)` and `buildIcsBlob(session)` with proper CT→UTC conversion
- `src/lib/vip/qrDownload.ts` — extract canvas composition util (shared with `VipAvailability.tsx`)

**Edited:**
- `src/App.tsx` — add `<Route path="/vip/:slug/confirmed" element={<VipConfirmed />} />`
- `src/pages/VipAvailability.tsx` — after successful claim, `navigate(\`/vip/${slug}/confirmed\`)`; delete the inline confirmed JSX block
- `src/pages/VipMemberRegister.tsx` — add social proof pill + realtime subscription, hoist group/date header, replace success state copy, add Share/Copy button below form

**Untouched:** all internal app pages, DB schema, edge functions, `vip-availability` calendar/grid logic, `vip-roster`, `VipRegister.tsx` (the `/vip-register` legacy page).

---

## Verification

- Manual: claim a slot → confirms redirect to new page; QR scans to `/vip/:slug/register`; Copy/Share/Calendar buttons all work; .ics opens in Apple Calendar with correct CT-derived UTC times
- Realtime: open `/vip/:slug/register` in two tabs, submit one, watch the count pill increment in the other without refresh
- Mobile viewport (375px): timeline stacks vertically, all tap targets ≥ 44px, Share button surfaces (Copy Link suppressed)
- Desktop: Copy Link surfaces, Share suppressed
