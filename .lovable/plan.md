

## Goal
When logging "Booked an Intro" for a VIP registrant in the VIP Group outcomes sheet, actually create a real `intros_booked` record (with VIP source attribution) — and let the SA add a friend at the same time, mirroring the regular Book Intro drawer.

## Root cause
Today, picking "Booked an Intro" in `VipRegistrationsSheet` just writes `outcome = 'booked_intro'` on the `vip_registrations` row. No `intros_booked` row is created, so the registrant never appears in the intro pipeline, no questionnaire is provisioned, no commission attribution exists, and no friend can be added.

## What changes

### 1. `src/features/myDay/VipRegistrationsSheet.tsx`
When the SA picks **Booked an Intro** for a registrant, expand an inline booking form below that registrant's row (no separate dialog — keeps context). The form contains:
- **Class Date** (DatePickerField, required, default = today CST)
- **Class Time** (ClassTimeSelect, required)
- **Coach** (Select from `COACHES`, required)
- **Bringing a friend?** Yes/No toggle (matches `BookIntroSheet` pattern)
  - If Yes: First Name (required), Last Name, Phone (required)

A single **Save Booking** button (replaces the generic Save when this outcome is chosen) does all of the following in order:
1. Insert into `intros_booked` with:
   - `member_name`, `phone`, `email` from the VIP registration
   - `lead_source = 'VIP Class'`
   - `vip_session_id = vipSessionId` (from sheet props)
   - `booking_type_canon = 'STANDARD'`, `booking_status_canon = 'ACTIVE'`, `is_vip = false`
   - `intro_owner = booked_by = userName`, `coach_name`, `class_date`, `intro_time`, `class_start_at`
   - `sa_working_shift` (computed from current hour, same as BookIntroSheet)
   - `questionnaire_status_canon = 'not_sent'`
2. Auto-create questionnaire via existing `autoCreateQuestionnaire` helper
3. If friend = Yes: insert second `intros_booked` row with `lead_source = 'VIP Class (Friend)'`, `paired_booking_id` linked both ways, `referred_by_member_name = registrant's full name`, plus a `referrals` row and friend questionnaire (mirrors `BookIntroSheet` lines 263-316)
4. Update the `vip_registrations` row: `outcome = 'booked_intro'`, `outcome_notes`, `outcome_logged_at`, `outcome_logged_by = userName`
5. Toast success, collapse the inline form, mark row as logged

Other outcomes (Showed, No-Show, Interested, Not Interested, Purchased Membership) keep current behavior — only `booked_intro` triggers the booking form.

### 2. No changes needed elsewhere
- `intros_booked` already supports VIP attribution via `vip_session_id` + `lead_source = 'VIP Class'`
- VIP isolation memory: VIP bookings excluded from standard pipeline metrics — preserved
- Questionnaire trigger fires automatically for the new booking
- `My Day → Intros` will show the new booking via existing `vip_session_id` linkage

## Files changed
1. `src/features/myDay/VipRegistrationsSheet.tsx` — add inline booking form when `booked_intro` outcome selected; on save, create `intros_booked` (+ friend booking + questionnaires + referral) before logging the outcome

## Files audited, no change needed
- `src/components/dashboard/BookIntroSheet.tsx` — reference pattern for friend logic (lines 263-316), reused
- `src/lib/introHelpers.ts` — `autoCreateQuestionnaire` already exists
- `src/components/shared/FormHelpers.tsx` — `ClassTimeSelect`, `DatePickerField`, `formatPhoneAsYouType`, `autoCapitalizeName` reused
- `src/types/index.ts` — `COACHES` reused

## Downstream effects (explicit)
- VIP registrant marked "Booked an Intro" now appears as a real intro in My Day → Intros tab (filtered/visible per existing VIP rules)
- New booking gets a questionnaire link auto-provisioned
- Friend booking (when Yes) also created, paired, and given its own questionnaire + referral record (Group Contact / referrer attribution preserved)
- Total Journey close-rate, Per-SA, Per-Coach metrics: VIP isolation rules already exclude these from standard funnels — unchanged
- Commission attribution: `intro_owner = userName` (the SA logging the outcome) — matches existing intro ownership canon
- Coach View / WIG / Pipeline: VIP bookings stay isolated per existing `VIP Isolation` memory — no metric pollution
- No DB schema, no RLS, no migration changes
- No changes to other VIP outcome paths

## Confirm before building
None — friend pattern, VIP isolation, and questionnaire auto-creation are all established canon; this plan reuses them mechanically.

