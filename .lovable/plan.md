# Buddy cards + Move tabs to Outreach + Unified Portal reminder

## Where buddy card entries show up today

Buddy Card sign-ups (leads with `is_buddy_card = true`) currently appear in:

- **My Day → Leads tab** (`NewLeadsAlert.tsx`) — badged as "Buddy Card" with the referring member's name.
- **Pipeline** — normal lead row, buddy fields visible in detail.
- **SOML** — buddy card referrals feed `soml_pending_referrals` with the $50 credit owed to the referring member (via `soml_create_pending_referral` trigger).
- After booking: **My Day → Intros** with the buddy badge from `useJourneyCard` / `MyDayIntroCard`.
- Public entry point: `/buddy` (`BuddyCard.tsx`) — where friends fill it out.

After this change, buddy card leads will surface on **Outreach → New Leads** (same component, moved).

---

## Change 1 — Move New Leads, Follow-Up, and Scripts to the Outreach page

**My Day (`MyDayPage.tsx`)** — remove the `leads`, `followups`, and `scripts` tabs and their content. Keep only the Intros tab (plus the sections below it: Class Milestones, Milestones & Deploy, Referral Asks). Simplifies My Day to "what's happening today in the studio."

**Outreach (`OutreachLists.tsx` → renamed layout to `OutreachPage`)** — becomes a tabbed hub:

1. **Lists** (existing outreach lists content — unchanged)
2. **New Leads** — renders `<MyDayNewLeadsTab />` + `<NewLeadsAlert />` (buddy cards land here) with a big bold reminder banner (see Change 2)
3. **Follow-Up** — renders `<FollowUpList />` with the same reminder banner
4. **Scripts** — renders `<MyDayScriptsTab />`

Tab badges (new-leads count, follow-ups-due count) move with the tabs. Same underlying hooks — no data plumbing changes, just a location change. React Query keys unchanged so nothing else breaks.

**Nav** — `BottomNav` "Outreach" item already exists and is gated by `nav.outreach_lists`. Confirm SA + Coach both see it (currently: yes for SA, need to verify Coach — will grant if missing so Follow-Up stays reachable for coaches).

---

## Change 2 — "Marked off in Unified Portal" reminder banner

Persistent, always-visible banner at the top of both **New Leads** and **Follow-Up** tabs. Not a per-action prompt — a constant reminder as you asked.

Copy (bold + big, orange-accent left border on dark card):

> **Also mark this lead off in Unified Portal → Lead Management.**  
> Every text you send here needs to be recorded there too. Otherwise the studio double-contacts and it looks unprofessional.

No new DB fields, no logging, no dismissal — it stays put every session. One shared component `<UnifiedPortalReminder />` used in both tabs so copy stays in sync.

---

## Files touched

- `src/features/myDay/MyDayPage.tsx` — strip 3 tabs + their imports/state (`newLeadsCount`, `followUpsDueCount`, script send counter stays for FAB).
- `src/pages/OutreachLists.tsx` — wrap in tabs; existing content becomes the "Lists" tab.
- `src/features/outreach/UnifiedPortalReminder.tsx` — NEW shared banner component.
- `src/features/outreach/OutreachNewLeadsTab.tsx` — NEW thin wrapper (banner + `MyDayNewLeadsTab` + `NewLeadsAlert`).
- `src/features/outreach/OutreachFollowUpTab.tsx` — NEW thin wrapper (banner + `FollowUpList`).
- `src/features/outreach/OutreachScriptsTab.tsx` — NEW thin wrapper (re-exports `MyDayScriptsTab`).
- `src/lib/auth/roles.ts` — verify `nav.outreach_lists` visible for Coach role; adjust if not.

## Coherence checks before done

- New Leads count badge shows same number on Outreach that it used to show on My Day (query key `sa-new-leads` unchanged).
- Follow-Up list on Outreach = Follow-Up list previously on My Day (same `FollowUpList` component, same `useFollowUpData` hook).
- Buddy card lead created via `/buddy` appears on Outreach → New Leads with buddy badge (previously appeared on My Day → Leads).
- SA and Coach both see Outreach tab in `BottomNav`; Admin sees everything.
- No orphaned imports in `MyDayPage.tsx` after tab removal.  
  
I want buddy cards to have an admin dropdown where I can pull excel sheets on it as well