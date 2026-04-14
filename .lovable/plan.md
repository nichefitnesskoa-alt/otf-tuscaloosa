

## Plan: VIP Class Enhancements — Archived Sessions, VIP Banner, and "VIP Class (Friend)" Lead Source

Three changes: make VipSessionPicker include archived sessions and be optional, show VIP class origin on MyDay intro cards, and add a new "VIP Class (Friend)" lead source.

---

### Change 1 — VipSessionPicker: Include Archived Sessions, Make Optional

**File: `src/components/shared/VipSessionPicker.tsx`**
- Remove the `.is('archived_at', null)` filter so archived sessions appear in the dropdown
- Group sessions visually: active sessions first, then archived (with a label like "Archived" in the option text)
- Make `required` default to `false` — the picker is shown but not mandatory
- Add auto-select logic: accept an optional `autoMatchSessionId` prop. When the booking already has a `vip_session_id`, pre-select it even if archived.

### Change 2 — Show VIP Class Name on MyDay Intro Cards

**File: `src/features/myDay/IntroRowCard.tsx`**
- When `intro.vipClassName` is truthy (or `intro.leadSource` includes "VIP"), show a purple banner/badge below the name row:
  `"VIP Class: [Group Name]"` — e.g. "VIP Class: Tuscaloosa Fire Dept"
- This gives the SA immediate context on who this person is and which group they came from
- The data (`vipClassName`) is already fetched in `useUpcomingIntrosData.ts` and available on `UpcomingIntroItem`

**File: `src/components/myday/MyDayIntroCard.tsx`** (coach view card)
- Add optional `vipClassName?: string | null` to the `MyDayIntroCardBooking` interface
- Display the same purple VIP class badge when present

### Change 3 — Add "VIP Class (Friend)" Lead Source

**File: `src/types/index.ts`**
- Add `'VIP Class (Friend)'` to the `LEAD_SOURCES` array (alphabetically after 'VIP Class')

**File: `src/components/dashboard/BookIntroSheet.tsx`**
- When `leadSource === 'VIP Class (Friend)'`, also show the VipSessionPicker (same as 'VIP Class') but not required
- Add 'VIP Class (Friend)' to `REFERRAL_SOURCES` set so the referral name field appears

**File: `src/features/pipeline/components/PipelineDialogs.tsx`**
- Same treatment: show VipSessionPicker for 'VIP Class (Friend)' lead source

**File: `src/lib/vip/vipRules.ts`**
- The existing `b.lead_source.toLowerCase().includes('vip')` check already covers 'VIP Class (Friend)' — no change needed here

**File: `src/features/pipeline/selectors.ts`**
- Same — the `.includes('vip')` check already captures this. Verify no hardcoded `=== 'VIP Class'` filters need updating.

**File: `src/components/admin/ClientJourneyPanel.tsx`**
- Lines 621-622 use `=== 'VIP Class'` — update to also match 'VIP Class (Friend)'

### Change 4 — Auto-Pull VIP Session Info

**File: `src/components/dashboard/BookIntroSheet.tsx`**
- When reschedule mode selects a member whose `lead_source` is 'VIP Class' or 'VIP Class (Friend)', auto-populate `vipSessionId` from their existing booking's `vip_session_id`
- Add `vip_session_id` to the reschedule search query fields

---

### Files Changed
1. `src/components/shared/VipSessionPicker.tsx` — include archived sessions, make not required
2. `src/features/myDay/IntroRowCard.tsx` — show VIP class name banner
3. `src/components/myday/MyDayIntroCard.tsx` — add vipClassName to interface + display
4. `src/types/index.ts` — add 'VIP Class (Friend)' lead source
5. `src/components/dashboard/BookIntroSheet.tsx` — support new lead source + auto-pull VIP session
6. `src/features/pipeline/components/PipelineDialogs.tsx` — support new lead source in picker
7. `src/components/admin/ClientJourneyPanel.tsx` — update VIP tab filter

### No Database Migration Needed
All fields already exist. `vip_class_name` and `vip_session_id` are on `intros_booked`. Lead source is a free-text field.

