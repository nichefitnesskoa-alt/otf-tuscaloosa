Everything is good, but add in that I also need to manually add people into a specific VIP group easily  
  
Plan: Fix VIP-to-Pipeline Visibility + "Book Intro" from VIP Tab + Referral Member per VIP Group

### Problem Summary

1. **Payton Fuller not showing in pipeline**: The `isExcludedJourney` filter in `selectors.ts` excludes any journey where a booking's `lead_source` contains "vip" (case-insensitive). Since Payton was booked with lead source "VIP class", she's hidden from all main tabs and only visible under the VIP tab. But VIP tab uses `VipPipelineTable` which only fetches bookings with `lead_source = 'VIP Class'` AND `vip_class_name IS NOT NULL` -- so if she has no `vip_class_name`, she may not appear there either.
2. **No "Book Intro" action on VIP tab**: The VIP table has Script, Copy Phone, Assign Session, and Delete actions, but no way to convert a VIP member into a real intro booking.
3. **No referral member tracking per VIP group**: No field exists to record which current member is running each VIP class for referral credit.

---

### Changes

#### 1. Add "Convert to Intro" button to VIP table (`src/features/pipeline/components/VipPipelineTable.tsx`)

- Add `ArrowRight` icon import and the `ConvertVipToIntroDialog` component import.
- Add state for `convertRow: VipRow | null`.
- Add a "Book Intro" action button next to existing action buttons in each row.
- When clicked, open the `ConvertVipToIntroDialog` with the VIP member's data.
- On conversion, the dialog creates a new STANDARD booking with `lead_source: 'VIP Class (Converted)'`, `booking_type_canon: 'STANDARD'`, and the VIP booking gets marked as converted.
- After conversion, refresh data.

#### 2. Update ConvertVipToIntroDialog to support referral member (`src/components/vip/ConvertVipToIntroDialog.tsx`)

- Add an optional `referredByMember` prop that pre-fills `referred_by_member_name` on the new booking.
- The converted booking gets:
  - `lead_source: 'VIP Class'` (keeps the origin visible)
  - `booking_type_canon: 'STANDARD'` (enters normal pipeline)
  - `is_vip: false`
  - `referred_by_member_name` set to the VIP group's assigned member

#### 3. Fix pipeline filtering so converted VIP bookings show in main tabs (`src/features/pipeline/selectors.ts`)

- Update `isExcludedJourney` to NOT exclude bookings where `booking_type_canon === 'STANDARD'` even if `lead_source` contains "vip". The key distinction: VIP bookings have `booking_type_canon = 'VIP'` or `is_vip = true`. A converted VIP has `booking_type_canon = 'STANDARD'` and `is_vip = false`.
- Refine the filter: instead of checking lead_source for "vip", check `booking_type_canon` and `is_vip` fields. This way "VIP Class" as a lead source doesn't auto-exclude from pipeline — only actual VIP-type bookings are excluded.

#### 4. Add "Referring Member" field per VIP group (database + UI)

- **Database migration**: Add `referring_member_name TEXT` column to `vip_sessions` table. This tracks which current member is setting up each VIP class.
- **VIP table UI**: Show the referring member next to the group name. Add an inline edit to set/change it (small input or click-to-edit pattern).
- **Conversion flow**: When converting a VIP member to an intro, auto-populate `referred_by_member_name` on the new booking from the VIP group's `referring_member_name`.

#### 5. VIP group referral credit propagation

- When a VIP member is converted to an intro via the dialog, the `referred_by_member_name` from the `vip_sessions` table is written to the new `intros_booked` record's existing `referred_by_member_name` column.
- This ensures referral tracking and credit attribution flow through the existing referral system.

---

### Technical Details

`**selectors.ts` filter fix** (core issue):

```typescript
// Current (too aggressive — excludes by lead_source string):
const isExcludedJourney = (j) =>
  j.bookings.some(b =>
    b.lead_source === 'VIP Class' ||
    b.is_vip === true ||
    b.booking_type_canon === 'VIP' ||
    b.booking_type_canon === 'COMP' ||
    (b.lead_source && b.lead_source.toLowerCase().includes('vip'))
  );

// Fixed (only exclude actual VIP/COMP type bookings):
const isExcludedJourney = (j) =>
  j.bookings.every(b =>
    b.is_vip === true ||
    b.booking_type_canon === 'VIP' ||
    b.booking_type_canon === 'COMP'
  );
```

The logic changes from "exclude if ANY booking has VIP lead source" to "exclude only if ALL bookings are VIP/COMP type". This way, once a VIP is converted (creating a STANDARD booking), the journey appears in main pipeline tabs. Pure unconverted VIP members stay isolated.

**Database migration**:

```sql
ALTER TABLE public.vip_sessions ADD COLUMN referring_member_name TEXT;
```

**Files to modify**:

- `src/features/pipeline/selectors.ts` — fix `isExcludedJourney` and VIP count logic
- `src/features/pipeline/components/VipPipelineTable.tsx` — add "Book Intro" button, referring member UI
- `src/components/vip/ConvertVipToIntroDialog.tsx` — accept and apply `referredByMember` prop
- Database migration for `referring_member_name` on `vip_sessions`