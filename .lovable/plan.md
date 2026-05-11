**GroupMe recap wording.** The spec notes that recap text will start saying "Standard" instead of "AM Shift / Mid Shift / PM Shift" and calls it acceptable. It isn't. That surfaces to members and staff in GroupMe and looks broken. Add one line to the migration: map display label `'standard'` → `"Today's Shift"` in `lib/groupme.ts` wherever shift_type is written into recap text.  
  
Goal

Kill the morning / mid / last / weekend selector on the shift view. When an SA logs in, drop them straight into one unified daily checklist using the morning shift's wording. One shift per SA per day. Leave historic data alone.

## What changes (UI)

`**src/features/myDay/ShiftChecklist.tsx**`

- Delete the `SHIFTS` array and the 4-button shift picker.
- Delete the `shiftType` state and the "Switch shift" button. No more selector screen, no more switching.
- On mount, set the working shift to a single canonical value: `'standard'`.
- Header now reads simply: "Today's Shift — [date]" (no AM/PM/Weekend label, no time-range chip).
- Everything else (5 standard cards, referral row, end-of-shift submission, "X of 5 standards complete" indicator) stays exactly as it is.

`**src/features/myDay/MyDayShiftSummary.tsx**` (the compact activity strip)

- Remove the `Select` for AM/Mid/PM. Always read/write the same `'standard'` shift_type for today.
- Same calls/texts/DMs inputs, same autosave behavior.

`**src/features/shiftView/ShiftSelector.tsx**` and `**src/features/shiftView/ShiftViewPage.tsx**`

- Already orphaned (not in the router). Leave untouched — separate cleanup pass if ever needed.

## What changes (data)

**Templates** (`shift_task_templates`): seed a single `shift_type = 'standard'` set of 12 tasks using the current morning wording (which Koa already edited):

```
10  Name on whiteboard before intros arrive
11  Booking confirmation and questionnaire sent for today
12  Read their questionnaire before they walk in — know one thing about them
20  Comment genuinely on posts on feed or people we follow today  (count: Comments Made)
21  IG DMs sent this shift  (count: DMs sent)
22  Lead texts sent this shift — new or cold  (count: Texts sent)
30  Follow-up queue worked this shift
31  At least one person got a real next step — a booking, a date, a real answer
40  Create a connection with a member. Learn something new about them.
41  Ask a member if they have a friend who wants a free class
50  Milestones checked after every check-in wave — bag prepped before they finish class
51  Rowers checked and charging if needed — nothing left for the next SA to discover
```

- Deactivate (set `is_active = false`) all current `shift_type IN ('morning','mid','last','weekend')` template rows. They stay in the table for audit; they just stop rendering.
- Insert the 12 `'standard'` rows above with `is_active = true`.
- `TASK_STANDARD_MAP` in `src/features/shiftView/standards.ts` already keys by exact task_name, so the standard grouping continues to work without code changes there.

**Completions and recaps**: no schema changes, no migrations of historic rows. New writes from `ShiftChecklist` and `MyDayShiftSummary` go to `shift_type = 'standard'`. Historic rows keep `morning/mid/last/weekend` labels.

## Downstream surfaces — what each will see

These all read shift_type but don't enumerate hardcoded values, so they keep working — they'll just show `standard` going forward instead of `AM/Mid/PM`:

- `useSaLeaderboard.ts`, `lib/sa/saStreaks.ts`, `lib/sa/coverage.ts` — aggregate by sa_name across all shift_types. Unaffected.
- `WigSaLeaderboard.tsx`, `useWinTheDayItems.ts` — read `count_logged` totals per SA per day. Unaffected.
- `lib/groupme.ts` / `post-groupme/index.ts` — recap text that currently says "AM Shift / Mid Shift / PM Shift" will start saying "Standard". Acceptable per "leave history alone."
- `SaDetail.tsx`, `ShiftRecapDetails.tsx`, `ShiftRecapsEditor.tsx`, `ShiftTasksAdmin.tsx` (admin views) — historic rows still display their original shift_type; new rows display "Standard." No code change required.
- `ShiftRecap.tsx` (the legacy /shift-recap page, if still routed) — unchanged. Its own selector continues to work for backfilling historic shifts. If you want it gone too, say so and I'll fold that in.

## Coherence checks before declaring done

- Log in as a test SA: shift checklist renders immediately (no picker), shows the 12 morning-wording tasks grouped under the 5 standards, plus the referral row in S4 and the end-of-shift card.
- Check a task → verify a row in `shift_task_completions` with `shift_type = 'standard'`.
- Type into a count field → verify `count_logged` increments on the same `'standard'` row.
- WIG SA leaderboard total for that SA reflects the new count.
- Submit end-of-shift → verify a `shift_submissions` row with `shift_type = 'standard'`.
- Open admin `ShiftTasksAdmin` → confirm only the 12 `standard` tasks render as active; old morning/mid/last/weekend rows show as inactive.

## Files touched

- `src/features/myDay/ShiftChecklist.tsx` — strip selector, lock to `'standard'`.
- `src/features/myDay/MyDayShiftSummary.tsx` — strip Select, lock to `'standard'`.
- One migration: insert 12 `standard` template rows; deactivate old shift_type templates.

## Open questions

None — answers from the previous round were enough. If you want the legacy `/shift-recap` page or the orphaned `ShiftViewPage.tsx` removed in the same pass, say the word and I'll add it.