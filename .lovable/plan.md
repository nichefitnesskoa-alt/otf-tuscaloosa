

# Log-as-Sent Buttons, Remove "Ask a Friend", Full Q Answers, and Objections Tab Overhaul

## 1. Add "Log as Sent" Buttons on Each Step in My Day Intro Cards

Currently, the journey guidance line (e.g., "Step 4: Send confirmation...") is passive text. Users need a clear, tappable way to mark each step as done.

### Changes to `src/pages/MyDay.tsx`
- Track per-booking step completion using a new state map: `stepCompletionsMap` keyed by `booking_id`, storing which action types have been logged (from `script_actions` table).
- For each step shown in the card (collapsed or expanded), render a small "Mark Done" / checkmark button next to the guidance text that inserts a `script_actions` row with the appropriate `action_type` (e.g., `confirmation_sent`, `q_reminder_sent`).

### Changes to `src/components/dashboard/CardGuidance.tsx`
- Export a new component `CardGuidanceWithAction` that wraps `CardGuidance` text with an inline "Done" button.
- When tapped, it calls a callback prop (`onMarkDone`) that writes to `script_actions` and updates the local state.
- Once marked done, the button turns into a green checkmark showing who completed it and when.

### Changes to `src/pages/MyDay.tsx` data fetching
- Expand the `script_actions` query to fetch ALL action types per booking (not just `script_sent` and `intro_logged`), so we can derive `confirmationSent`, `qSent`, etc. from a single source of truth.
- Feed these into the `getJourneyGuidance` context so step progression actually advances.

## 2. Remove "Step 3: Ask a Friend" from the Journey

### Changes to `src/components/dashboard/CardGuidance.tsx`
- Remove the `askAFriendSent` field from `JourneyContext`.
- Remove the `if (!ctx.askAFriendSent && !ctx.confirmationSent)` block (lines 110-112).
- Renumber: after Step 2 (Book Intro), the next step becomes Step 3: Send confirmation with questionnaire link.
- Shift all subsequent step numbers down by 1.

Updated step flow:
```
Step 1: Contact lead
Step 2: Book intro
Step 3: Send confirmation with questionnaire link
Step 4: Waiting for questionnaire / send reminder
Step 5: Ready for intro, review answers (tap Prep)
Step 6: Intro today, review answers (tap Prep)
Step 7: Log what happened (tap Log Intro)
Step 8: Send follow-up / welcome text
Step 9: Ask for referral
```

## 3. Show Full Questionnaire Answers in Prep (No Shorthand)

### Changes to `src/components/dashboard/PrepDrawer.tsx`
- In the Prep tab Q summary block, show the full question text as labels instead of short labels.
- Add back the Goal and Obstacle rows to the Q summary (currently they only appear as individual cards below). The summary should show every Q answer with the full question wording:
  - "What is your primary fitness goal?" -> full answer
  - "How would you rate your current fitness level (1-5)?" -> full answer
  - "What has been the biggest obstacle to reaching your fitness goals?" -> full answer
  - "What have you tried before for fitness?" -> full answer
  - "What would reaching your goal mean to you emotionally?" -> full answer
  - "How many days per week can you realistically commit?" -> full answer
  - "Which days work best for you?" -> full answer
  - "Anything else the coach should know?" -> full answer

## 4. Redesign the Objections Tab

Currently the Objections tab renders `EirmaPlaybook` which only shows content when obstacles match playbook entries. If no match or no Q data, it's empty.

### New approach: Make the Objections tab a standalone reference tool
- **Always show content** regardless of questionnaire status.
- **Section 1: Matched Objections** (if Q data exists) -- Keep the current EIRMA playbook for matched obstacles, personalized with the prospect's data.
- **Section 2: Common Objections Quick Reference** -- Always visible. Show a condensed list of the most common objections (Price, Time, Spouse, "Think About It", "Not Sure It's For Me") with a 1-2 line EIRMA response for each. This makes the tab useful even without Q data.
- **Section 3: "I Need to Think About It" Handler** -- Already exists at the bottom of EirmaPlaybook; move it to be more prominent.
- **Section 4: Accusation Audit** -- Add the accusation audit script here as well (it's currently only in The Close tab). Having it in both places ensures the SA can reference it quickly from the Objections tab.

### Changes to `src/components/dashboard/PrepDrawer.tsx`
- Replace the empty-state fallback in the Objections tab with the new always-visible content.
- Render `EirmaPlaybook` for matched playbooks when Q data exists.
- Below it, always render a "Common Objections" section with hardcoded quick-reference cards for the top 5 objections.
- Add the accusation audit text at the bottom.

### Changes to `src/components/dashboard/EirmaPlaybook.tsx`
- Remove the early `return null` when `matched.length === 0 && fitnessLevel > 2` -- let the parent control visibility.
- Export the "I need to think about it" block as a separate component so it can be positioned by the parent.

## Technical Details

- New `script_actions` action types for step tracking: `confirmation_sent`, `q_reminder_sent`, `mid_class_checkin`, `prep_reviewed`.
- The "Mark Done" button writes: `{ booking_id, action_type, completed_by: user.name, completed_at: now() }`.
- No new database tables needed -- uses existing `script_actions` table.
- No migration needed -- the `action_type` column is a text field, not an enum.
- The step renumbering in `CardGuidance.tsx` is purely a display change.

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/CardGuidance.tsx` | Remove askAFriend step, renumber steps, export `CardGuidanceWithAction` component |
| `src/pages/MyDay.tsx` | Expand script_actions query, add step completion state, wire "Mark Done" callbacks, pass to guidance components |
| `src/components/dashboard/PrepDrawer.tsx` | Full Q labels in Prep tab, redesign Objections tab with always-visible content |
| `src/components/dashboard/EirmaPlaybook.tsx` | Remove early null return, export "Think About It" block |

