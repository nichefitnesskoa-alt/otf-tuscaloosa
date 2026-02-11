

# Auto-Import Online Intros into Client Pipeline

## Overview

Update the `import-lead` edge function to handle a new nested payload format that includes booking data. When your Apps Script POSTs a parsed Orangebook email, the system will automatically create a lead AND an `intros_booked` record so it appears in "Booked / Upcoming" immediately -- no manual shift recap step needed.

Coach name will be left blank (empty string / TBD), so the existing intro run flow will require coach selection as usual.

## Database Changes

### New table: `intake_events`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| source | text | e.g. 'gmail' |
| external_id | text | Unique -- stores `meta.gmail_message_id` |
| payload | jsonb | Full request body for audit |
| lead_id | UUID | Nullable |
| booking_id | UUID | Nullable |
| received_at | timestamptz | Default now() |

Open RLS policies (matching existing app pattern). The unique constraint on `external_id` prevents the same email from being processed twice.

## Edge Function: `import-lead` Rewrite

The function will detect the payload format automatically and handle both:

### Format A (existing -- backward compatible)
Flat JSON with `first_name`, `last_name`, `email`, `phone`. Works exactly as it does today.

### Format B (new -- booking + idempotency)
Nested JSON with `lead`, `booking`, and `meta` objects.

Processing steps for Format B:

1. **Auth** -- validate `x-api-key` (unchanged)
2. **Idempotency** -- check `intake_events` for `external_id` matching `meta.gmail_message_id`. If found, return 200 with `{ ok: true, duplicate: true }` and stop.
3. **Upsert lead** -- match by email OR phone. If found, fill in any missing fields (name, phone, email). If not found, create new lead with stage `'new'`.
4. **Parse date/time** -- convert `MM-DD-YYYY` to `YYYY-MM-DD` and `h:mm AM/PM` to `HH:MM` 24-hour format. Return 400 if parsing fails.
5. **Dedupe booking** -- check `intros_booked` for same member name + class_date + intro_time. Skip if already exists.
6. **Create booking** -- insert into `intros_booked` with:
   - `member_name`: "FirstName LastName"
   - `class_date`: parsed date
   - `intro_time`: parsed time
   - `lead_source`: "Online Intro Offer (self-booked)"
   - `coach_name`: "TBD" (left blank so coach must be selected when the intro is run)
   - `sa_working_shift`: "Online"
   - `booked_by`: "System (Auto-Import)"
   - `booking_status`: "Active"
7. **Record intake event** -- insert into `intake_events` with full payload, lead_id, and booking_id.
8. **Return response**:
```json
{
  "ok": true,
  "lead_id": "...",
  "booking_id": "...",
  "created_lead": true,
  "created_booking": true
}
```

## Coach Name Handling

The `coach_name` field will be set to `"TBD"`. Your existing intro run flow already checks for this -- when an SA selects a booking with a TBD coach to log an intro run, the `IntroRunEntry` component shows a required coach selection prompt. No changes needed on the frontend for this.

## No Frontend Changes Needed

The Client Pipeline "Upcoming" tab already reads from `intros_booked` where `booking_status = 'Active'` and `class_date` is in the future. Auto-imported bookings will appear there automatically.

## File Summary

| Action | File |
|--------|------|
| Migration | Create `intake_events` table with unique constraint on `external_id` |
| Rewrite | `supabase/functions/import-lead/index.ts` |

