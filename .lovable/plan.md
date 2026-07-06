## Problem

Lauren self-booked via her intro link but her MyDay card gives Koa no signal about the questionnaire. Reality:

- Her `intros_booked.questionnaire_status_canon = 'not_sent'` (the auto-created questionnaire never got marked "sent" because no SA texted it — she was handed it immediately after booking)
- Her `intro_questionnaires.last_opened_at = null` and `submitted_at = null` — so she clicked "Copy Link" for a friend, skipped "Continue", and never opened the form
- MyDay card just shows "Not sent" which is misleading — the link WAS effectively served to her

We need the card to distinguish four real states for self-booked leads.

## Plan

### 1. Mark self-booked questionnaires as "sent" at booking time

In `src/pages/BookIntro.tsx`, right after we look up the auto-created questionnaire slug (~line 291), also stamp the linked booking:

```
questionnaire_status_canon = 'sent'
questionnaire_sent_at = now()
```

This reflects reality: the link is being served to the intro on the very next screen. No SA action needed.

### 2. Track "opened" as a first-class card state

Add a derived status in `src/features/myDay/useUpcomingIntrosData.ts` for self-booked leads where the joined `intro_questionnaires.last_opened_at` is set but `submitted_at` is null. Include `last_opened_at` in the existing `qMap` select.

New `QuestionnaireStatus` value: `Q_OPENED`. Priority order when deriving:
`submitted → Q_COMPLETED` › `last_opened_at → Q_OPENED` › `booking flag 'sent' → Q_SENT` › else `Q_NOT_SENT`.

### 3. Surface all four states on the MyDay intro card

In `src/features/shiftView/ShiftIntroCards.tsx` (and the coach mirror in `CoachIntroCard.tsx`), replace the current two-state badge with:

- **Gray** "Q not opened" — link served, never opened
- **Amber** "Q opened, not submitted · {relative time}" — she started but bailed
- **Green** "Q completed · {relative time}" — done
- Legacy **Gray** "Q not sent" — for older bookings that never got the sent stamp

Lauren's card would immediately read **"Q not opened"** — telling Koa she copied the friend link and left without filling anything out.

### 4. DB safety net — trigger on questionnaire submit

Add a trigger on `intro_questionnaires` AFTER UPDATE: when `status` transitions to `submitted`/`completed` and `booking_id` is set, mirror the update into `intros_booked.questionnaire_status_canon = 'completed'` + `questionnaire_completed_at = NEW.submitted_at`. Belt-and-suspenders for the existing client-side write in `Questionnaire.tsx` (RLS or a race could drop it today).

### 5. Backfill

One-time UPDATE for existing self-booked bookings where a questionnaire exists but the booking is still `not_sent`:
- If questionnaire `submitted_at` is set → mark booking `completed` + copy timestamps
- Else if `last_opened_at` is set → leave booking canon at `sent` (the "opened" state is derived, not stored)
- Else if booking came from the intro-link flow → set canon to `sent`

## Files touched

- `src/pages/BookIntro.tsx` — stamp `sent` at booking time
- `src/features/myDay/useUpcomingIntrosData.ts` — pull `last_opened_at`, derive `Q_OPENED`
- `src/features/shiftView/ShiftIntroCards.tsx` — 4-state badge
- `src/components/coach/CoachIntroCard.tsx` — same badge (Coach View mirror)
- New migration — submit trigger + one-time backfill

## Coherence check before done

- Query Lauren's booking after deploy: card status = `Q not opened`, questionnaire row unchanged
- Simulate: open her `/q/…` slug → card flips to `Q opened, not submitted`
- Submit the form → card flips to `Q completed` on both MyDay and Coach View (same underlying field)
- Verify no other consumer of `questionnaire_status_canon` breaks on the new `sent` writes at booking time (Pipeline, WalkIn sheet, dashboard funnels)