## Add "Log Sent" button to Follow-Up cards

The follow-up cards on My Day (rendered by `src/features/followUp/FollowUpList.tsx`) currently show three actions: **Send Text**, **Copy Phone**, **Log Outcome**. There is no way to mark a script as sent without going back through the Send Text drawer. This adds a fourth action: **Log Sent**.

### What changes

**File: `src/features/followUp/FollowUpList.tsx`**

In `FollowUpCard`, add a `Log Sent` button to the action row, between Copy Phone and Log Outcome.

- Label: **Log Sent** (full readable text, no abbreviation)
- Icon: `CheckCheck` from lucide-react
- Style: `variant="outline"`, `min-h-[44px]`, matches sibling buttons
- On click: insert into `script_actions` with:
  - `action_type: 'script_sent'`
  - `booking_id: item.bookingId`
  - `category` mapped from `followUpType` using the same map already used by `handleSendText` (no_show / reschedule / follow_up)
  - `created_by: userName`
- Show toast `"Logged as sent"` (2-second confirmation per UI standards)
- After insert, call `onRefresh()` so the card re-reads `lastContactAt` and the 7-day cooling/dimming logic applies immediately
- Disable the button briefly while the insert is in flight (local `useState` saving flag) to prevent double-taps

### Action row layout

```text
[ Send Text (orange, flex-1) ] [ Copy ] [ Log Sent ] [ Log Outcome (flex-1) ]
```

`Log Sent` and `Log Outcome` both stay 44px tall with full labels. Copy stays as the icon-only square it already is.

### Downstream effects (verified, none broken)

- `FollowUpQueue` on the Leads page is a separate component and is out of scope.
- `script_actions` insert is the same shape used elsewhere when the Send Text drawer logs a sent message, so the daily "follow-ups sent" counter on My Day (`todayFollowUpsSent` in `MyDayPage.tsx`) will pick this up automatically — no other file needs changes.
- 7-day cooling dimming reads `lastContactAt` via `useFollowUpData`; calling `onRefresh()` after insert refreshes that data so the card visually dims as expected.
- No schema changes. No RLS changes. No role-permission changes.

### Out of scope

- No changes to `FollowUpQueue` (Leads page).
- No changes to the Send Text flow, script picker, or script_actions schema.
- No changes to layout/styling of any other card or page.