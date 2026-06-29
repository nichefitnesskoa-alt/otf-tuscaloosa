## Goal
Add an `{arrival-time}` merge field that auto-renders 30 minutes before class start, and update the 1st Intro Booking Confirmation template to use it. The 11:30 dropdown entry is already present — no code change needed there.

## Changes

**1. `src/lib/script-context.ts`** — when `classTime` is present, also compute `arrival-time` as `classTime − 30 min`, formatted the same way as `{time}` (e.g. `5:00 AM`, `12:00 PM`). Edge cases (midnight rollover, missing time) fall back gracefully to "20–30 min before class".

**2. `src/components/scripts/MergeFieldReference.tsx`** — add `{arrival-time}` with description "Class time minus 30 min (e.g. 5:00 AM)" so SAs can insert it into other templates.

**3. Database update** (`script_templates` row `1cca9ed8-f127-49cc-a22e-cce61a987e04`, "1st Intro Booking Confirmation") — replace body with:

```
Hey {first-name}, it's {sa-name} from Orangetheory!

You're booked {day} at {time}.

What to expect before your first class!

-Arrival: Come at {arrival-time} for a tour, heart rate monitor setup, and to meet coach {coach-name}. They'll teach you how the class works. Additionally, we offer a complimentary InBody scan which will give you information about your muscle composition.

-Coach {coach-name} wants to know a little more about you and your fitness goals to help personalize the class your goals

{questionnaire-link}

We're so excited for you!

Reply YES to confirm! or RESCHEDULE to reschedule!
```

## Note on 11:30
`CLASS_TIMES` in `src/types/index.ts` already includes `11:30` with label `11:30 AM`. Per your answer, I'm leaving `src/lib/classSchedule.ts` (today's auto-schedule for milestones/coach-prep) untouched.

## Coherence proof (after build)
- Render test: booking at `12:00` → `{arrival-time}` = `11:30 AM`; booking at `05:00` → `{arrival-time}` = `4:30 AM`.
- DB verify: `SELECT body FROM script_templates WHERE id = '1cca9ed8…'` returns the updated body containing `{arrival-time}`.
- Scripts page → 1st Intro Booking Confirmation → Generate against a real booking shows the rendered arrival time matching class time − 30 min.
