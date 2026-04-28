## What you'll get

1. **Search by phone in Pipeline** (and the other in‑app search boxes that should support it)
2. **Birthday + weight visible** for each registrant in the MyDay VIP group sheet — no more bouncing to Pipeline to look it up

## 1. Phone search

Right now the Pipeline search bar only matches **member name** and **intro owner**. It will be updated to also match **phone number** (digits-only matching, so `(205) 555-1234`, `205-555-1234`, and `2055551234` all work).

The same upgrade will apply to the other "name-only" search boxes that show up daily:

| Location | Today | After |
|---|---|---|
| Pipeline filter bar | name / owner | + phone |
| Pipeline → Find existing client dialog | name | + phone |
| Admin → Client Journey Panel | name / owner | + phone |
| Past Booking Questionnaires picker | name | + phone |
| Booked Intro Selector | name | + phone |
| ContactLogger (My Day) | name | + phone |
| Client Search Script Picker | name | + phone |

Out of scope (already supports phone, or not relevant): GlobalSearch (already does), VIP pipeline table (already does), Scripts search, Milestones search.

## 2. MyDay VIP group sheet — show birthday & weight

In the VIP registrations sheet (opened from a VIP card on My Day), each attendee row currently shows just **Name + Copy/Script/Outcome buttons**. It will be expanded to show:

- **Birthday** (e.g. "🎂 Mar 14") — only if on file
- **Weight** (e.g. "⚖ 165 lb") — only if on file

Displayed as a small muted line under the name, so the row stays compact. Missing values are simply hidden (no "—").

The data already exists on the `vip_registrations` table (`birthday`, `weight_lbs` columns) — just need to select and render them.

## Technical notes

- **Pipeline search**: extend `filterBySearch` in `src/features/pipeline/selectors.ts` to also match against `bookings[].phone` using a digits-only comparison (strip non-digits from both query and stored value, require ≥3 digits before phone-matching to avoid noise). Update placeholder to "Search name, phone, or intro owner…".
- **Other search boxes**: add the same digits-only phone match alongside existing name match in each component listed above.
- **VIP sheet**: add `birthday, weight_lbs` to the `vip_registrations` select in `src/features/myDay/VipRegistrationsSheet.tsx`, render under the name with `date-fns` formatting for birthday.

No DB changes. No new dependencies.