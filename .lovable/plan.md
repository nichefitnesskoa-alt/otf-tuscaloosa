

# Universal Phone Formatting + 2nd Intro Phone Inheritance Fix + Continuous Data Audit

## Problem Summary

1. **Phone numbers display with `+1` prefix** — `phone_e164` values like `+15129000350` are shown raw on cards and pipeline instead of formatted as `(512) 900-0350`.
2. **2nd intro cards show "Phone missing"** even though the original booking has phone data — existing 2nd intros in the DB were created before the inheritance fix was added, and the data hook doesn't fall back to the originating booking's phone.
3. **No continuous auto-correction** — the audit engine detects missing phones but doesn't auto-fix them.

## Changes

### 1. Normalize all phone display universally (`src/lib/parsing/phone.ts`)

Add a new `normalizePhoneForDisplay` function that strips `+1` prefix, extracts 10 digits, and formats as `(XXX) XXX-XXXX`. Update the existing `formatPhoneDisplay` to also handle `+1XXXXXXXXXX` and `1XXXXXXXXXX` inputs.

### 2. Format phone on IntroRowCard (`src/features/myDay/IntroRowCard.tsx`)

- Import `formatPhoneDisplay` from `@/lib/parsing/phone`
- Use it everywhere `item.phone` is rendered (line 319 display badge, line 191 copy handler)
- Copy handler should copy the clean 10-digit number (no `+1`)

### 3. 2nd intro phone fallback in data hook (`src/features/myDay/useUpcomingIntrosData.ts`)

After building `rawItems`, for any item where `phone` is null AND `originating_booking_id` is not null (i.e., it's a 2nd intro), look up the originating booking's phone from the same fetch batch. Since we already fetch all bookings, check if the originating booking is in our result set. If not, do a targeted query for originating booking phones.

**Implementation:**
- After `rawItems` is built, create a map of `bookingId → phone` from all items
- For items with no phone and an `originatingBookingId`, check the map first
- If not found in the map, batch-query the missing originating IDs from `intros_booked` for their phone/phone_e164
- Assign the inherited phone to the 2nd intro item

### 4. Add auto-fix to audit engine (`src/lib/audit/dataAuditEngine.ts`)

Add a new audit check + auto-fix: `check2ndIntroPhoneInheritance`
- Query all `intros_booked` where `originating_booking_id IS NOT NULL` AND `phone IS NULL` AND `phone_e164 IS NULL`
- For each, look up the originating booking's phone
- Auto-fix: update the 2nd intro record with the originating booking's phone data
- Add `fixAction: 'fix_2nd_intro_phones'` so the admin "Fix Now" button triggers it

Also add a continuous phone normalization check that strips `+1` from `phone` field values and populates `phone_e164` where missing.

### 5. Format phones in Pipeline display (`src/features/pipeline/components/PipelineSpreadsheet.tsx`)

Apply `formatPhoneDisplay` to all phone displays in the pipeline spreadsheet view so numbers show as `(XXX) XXX-XXXX` instead of raw `+1XXXXXXXXXX`.

### 6. Trigger audit after data load on My Day

In `useUpcomingIntrosData.ts`, after building items, if any items have missing phone AND an originating booking ID, auto-fix those records in the background by copying phone from the originating booking. This makes the fix continuous and self-healing.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/parsing/phone.ts` | Update `formatPhoneDisplay` to handle `+1` prefix and 11-digit inputs; add `stripCountryCode` helper |
| `src/features/myDay/IntroRowCard.tsx` | Use `formatPhoneDisplay` for all phone rendering; strip `+1` from copied value |
| `src/features/myDay/useUpcomingIntrosData.ts` | Add originating-booking phone fallback for 2nd intros; auto-fix missing phone records in background |
| `src/lib/audit/dataAuditEngine.ts` | Add `check2ndIntroPhoneInheritance` audit check with auto-fix capability |
| `src/features/pipeline/components/PipelineSpreadsheet.tsx` | Format phone display with `formatPhoneDisplay` |

## Prompt to Reproduce This Build

Here is a prompt that would get you to this exact point:

> Build a fitness studio sales associate (SA) dashboard app for Orangetheory Fitness Tuscaloosa. The app tracks intro bookings (first-time visitors), their outcomes (purchased, didn't buy, no-show), follow-up sequences, and sales pipeline. Key features: (1) "My Day" page with today's intros, rest-of-week view with day sub-tabs, and a "Win the Day" shift checklist that navigates directly to specific intro cards. Each intro card shows questionnaire status as a colored banner, has inline editable time, Copy Q Link / Copy Phone buttons, coach assignment, and an outcome drawer. 2nd intro cards display previous intro info in a collapsible section and inherit phone/email/time from the originating booking. (2) Pipeline page with spreadsheet view grouping all bookings by client journey. (3) Phone numbers are stored as 10-digit strings, parsed from email imports via an extractPhone utility, and displayed universally as (XXX) XXX-XXXX without country code. A continuous data audit engine runs 12+ checks every 30 minutes and auto-corrects issues like missing phone numbers on 2nd intros by inheriting from the original booking. The app uses Supabase for data, has section guidance banners explaining each UI area, visual tab separators, and supports offline mode. Outcome changes route through a single canonical function (applyIntroOutcomeUpdate) that handles AMC tracking, follow-up queue generation, commission calculation, and audit logging.

