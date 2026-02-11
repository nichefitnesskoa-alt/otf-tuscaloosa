

# Override Lead Source with Booking's Actual Lead Source on Auto-Link

## The Problem

When a web lead (e.g., "Orangebook Web Lead") gets auto-linked to a Shift Recap booking, only the `stage` and `booked_intro_id` are updated. The lead's `source` field stays as "Orangebook Web Lead" even though the booking might have been sourced from "Instagram DMs", "Referral", etc. The booking's lead source should take precedence since the staff manually entered the real source.

## The Solution

Update both auto-link paths to also set the lead's `source` to the booking's `lead_source`:

### 1. Shift Recap Submission (`src/pages/ShiftRecap.tsx`)

Update `matchLeadByName` to accept an optional `leadSource` parameter. When linking a lead to a booking:
- If `leadSource` is provided, also update `leads.source` to that value
- The activity log note will include the source override (e.g., "Auto-linked from shift recap booking. Source updated to: Instagram DMs")

Call sites:
- After booking insert (~line 311): pass `booking.leadSource` to `matchLeadByName`
- After intro-run sale (~line 547): pass the run's lead source
- After outside-intro sale (~line 646): pass the sale's lead source

### 2. Import-Lead Edge Function (`supabase/functions/import-lead/index.ts`)

When a new web lead arrives and an existing booking is found in `intros_booked`:
- Fetch the booking's `lead_source` in addition to `id` (change `.select("id")` to `.select("id, lead_source")`)
- Use the booking's `lead_source` as the lead's `source` instead of the default "Orangebook Web Lead"
- This way the lead is created with the correct source from day one

---

## Technical Details

### `matchLeadByName` signature change

```
Before: matchLeadByName(memberName, bookingId, newStage)
After:  matchLeadByName(memberName, bookingId, newStage, leadSource?)
```

When `leadSource` is provided and non-empty, add `source: leadSource` to the update object.

### Edge function query change

```
Before: .select("id")
After:  .select("id, lead_source")
```

Then use `existingBooking.lead_source` as the source when creating the lead record.

---

## File Summary

| Action | File | What Changes |
|--------|------|-------------|
| Edit | `src/pages/ShiftRecap.tsx` | Add `leadSource` param to `matchLeadByName`, pass it from all 3 call sites |
| Edit | `supabase/functions/import-lead/index.ts` | Fetch booking's `lead_source`, use it as the lead's `source` |

