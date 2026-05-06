## Decluttering Plan — Confirmed Decisions

Based on your answers:
- Meeting → **keep** (planned use)
- My Shifts → **remove**
- Raffle → **remove**
- Campaigns → **remove**
- Stories → **keep**
- My Day tabs IG DM, Q Hub, Outcome → **remove tabs**, but preserve Q Hub's questionnaire-sending machinery so Scripts can still use it
- Reports / Recaps / Admin Intelligence → **consolidate into one place**

---

### 1. Remove `/my-shifts`
- Delete `src/pages/MyShifts.tsx`
- Remove route + import from `src/App.tsx`
- Redirect `/dashboard` (currently → `/my-shifts`) to `/my-day`
- Search-and-remove any nav links pointing to `/my-shifts`

### 2. Remove Raffle from Admin
- Delete `src/components/admin/RafflePage.tsx`
- Remove import, tab definition (line 514), and TabsContent block (lines 690–692) in `src/pages/Admin.tsx`

### 3. Remove Campaigns from Admin
- Delete `src/components/admin/CampaignsPanel.tsx`
- Remove import, tab definition (line 505), and TabsContent block (line 598–600) in `src/pages/Admin.tsx`
- Leave the `campaigns` and `campaign_sends` DB tables in place (no destructive migration) — purely UI removal

### 4. My Day — remove three tab triggers, keep underlying logic
In `src/features/myDay/MyDayPage.tsx`:
- Remove `TabsTrigger` for `igdm`, `qhub`, `outcome` (both the SA grid at lines 371–388 and any duplicate in the Coach branch if present)
- Remove the corresponding `TabsContent` blocks (442–462)
- Remove now-unused imports: `MyDayIgDmTab`, `QuestionnaireHub` import, `setIgDmCount`/`igDmCount` state if only used by the IG DM tab
- Keep `QuestionnaireHub` component file in place — it's the engine that lets Scripts auto-send questionnaires. It's just no longer surfaced as its own tab.
- Tab grid drops from 7 → 4 (Intros, Scripts, Follow-Ups, Leads). Update the `grid-cols-*` class accordingly.

Stories stay untouched.

### 5. Consolidate Reports / Recaps / Admin Intelligence
Single home: **Admin → Intelligence tab** (rename to **Analytics**).

- Move Recaps content (`src/pages/Recaps.tsx`) into Admin Analytics as a sub-section
- Move Reports content (`src/pages/Reports.tsx`) into Admin Analytics as a sub-section
- Admin Analytics tab gets internal sub-tabs: **Intelligence | Recaps | Reports**
- Delete `src/pages/Recaps.tsx` and `src/pages/Reports.tsx` after migrating their bodies into components under `src/components/admin/analytics/`
- Remove `/recaps` and `/reports` routes from `src/App.tsx`, replace with redirects to `/admin?tab=intelligence`
- Remove any nav links to `/recaps` or `/reports`

---

### Files Touched (expected)
- `src/App.tsx` — route removal + redirects
- `src/pages/Admin.tsx` — remove Raffle/Campaigns, rename Intelligence → Analytics, add sub-tabs
- `src/pages/MyShifts.tsx` — delete
- `src/pages/Recaps.tsx` — delete (content migrated)
- `src/pages/Reports.tsx` — delete (content migrated)
- `src/components/admin/RafflePage.tsx` — delete
- `src/components/admin/CampaignsPanel.tsx` — delete
- `src/components/admin/analytics/RecapsSection.tsx` — new (extracted)
- `src/components/admin/analytics/ReportsSection.tsx` — new (extracted)
- `src/features/myDay/MyDayPage.tsx` — remove 3 tabs, keep QuestionnaireHub import path alive only where Scripts use it
- Any `BottomNav` / `Header` / sidebar components referencing removed routes

### Confirm Before I Build
1. **Recaps and Reports**: OK to fold both into Admin → Analytics as sub-tabs (so they're admin-only going forward, same as today)? Or do you want Recaps to stay accessible to SAs?
2. **Q Hub**: I'll keep the underlying `QuestionnaireHub` component file so the auto-send-on-script flow continues to work. The tab itself disappears. Confirm.
