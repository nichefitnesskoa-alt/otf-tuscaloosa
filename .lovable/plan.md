## What's broken today

When you start booking an intro and type a name, the autocomplete only searches `intros_booked`. VIP attendees who registered through the VIP form but never had a real intro booked **never appear** — so you can't pull them up to schedule one. The Reschedule button is also wired only to update an existing booking; it has no path to "schedule a VIP person who's never had a booking."

## Fix in two parts

### 1. Make the name search find VIP registrants too
Extend `src/hooks/useDuplicateDetection.ts` so each name lookup runs in parallel against:
- `intros_booked` (today's behavior — unchanged)
- `vip_registrations` (NEW) — searches `first_name`/`last_name` with the same fuzzy matcher, joined to `vip_sessions` to get the class date + class name

VIP results are merged into the same `matches` array but tagged with a new field `source: 'booking' | 'vip'` and carry their `vip_session_id`, phone, email, and class info. If a VIP registrant already has a `booking_id`, we de-dupe — only the booking row is kept.

### 2. Make Reschedule work for VIP people
Update `src/components/ClientNameAutocomplete.tsx` to render VIP results with a purple **VIP** badge + the VIP class name/date underneath, so you can tell them apart instantly.

Update `src/components/RescheduleClientDialog.tsx` to handle two modes:

- **Existing booking** (today's behavior): UPDATE `intros_booked` with new date/time. Title stays "Reschedule {name}".
- **VIP registrant, no booking yet** (new): INSERT a new `intros_booked` row pre-filled from the VIP registration (`member_name`, `phone`, `email`, `vip_session_id`, `vip_class_name`, `lead_source = 'VIP Class'`, `booked_by = current user`, plus the new date/time chosen in the dialog). Then back-link by setting `vip_registrations.booking_id = newBookingId`. Title becomes "Schedule {name}" and the button reads "Book Intro" instead of "Update Booking". The current-booking info block is replaced with the VIP class context (e.g. "Registered for: Bama Sorority VIP — Apr 12").

Everything downstream (auto-questionnaire trigger, VIP back-link trigger, follow-up scheduling) already works on insert — no DB changes needed. The existing `auto_create_vip_registration` trigger handles the booking→registration link the other direction; we add the registration→booking link in app code at the moment of insert so the row Koa just typed is the one that gets attached (avoids the trigger picking the wrong match).

## Files touched

- `src/hooks/useDuplicateDetection.ts` — add VIP query + merge + source tag
- `src/components/ClientNameAutocomplete.tsx` — VIP badge + secondary line
- `src/components/RescheduleClientDialog.tsx` — dual-mode (update vs insert) plus VIP context block

No DB migrations, no changes to other autocomplete consumers (FollowupPurchaseEntry, SaleEntry, IntroBookingEntry, ReferralTracker, OutsideSaleSheets) — they keep working because the new VIP source is purely additive in the matches list, and only RescheduleClientDialog branches on it.

## One quick confirm
When you pick a VIP attendee and book their intro, should `lead_source` be:
1. **`VIP Class`** (recommended — keeps the standard VIP attribution chain), or
2. **`VIP Class (Friend)`** when they were a +1, or
3. Let you pick from a dropdown in the dialog?

I'll default to #1 and read `vip_status` from the registration to flip to #2 automatically if they were a friend, unless you say otherwise.
