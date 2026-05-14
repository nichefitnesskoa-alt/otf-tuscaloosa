## Problem

On My Day → New Leads, contacted leads have **Script / Book / Copy # / Move to New** but no way to remove a lead who said they're not interested (or wrong number, already a member, etc.). Same gap exists on the **New** sub-state. The user also wants Book Intro reachable directly from the card (already present on New/Contacted, but missing on the "Already in System" state where a verified-real lead may still want to book).

## Fix

Add a single canonical "Not Interested" action on the lead card across every active state, reusing the existing `MarkLostDialog` (already writes `stage='lost'` + `lost_reason` + activity log). Also add Book Intro to the Already-in-System state so a verified real lead can be booked without leaving the card.

### Files

1. **`src/features/myDay/MyDayNewLeadsTab.tsx`**
   - Import `MarkLostDialog`. Add `lostLead` state.
   - Add a new `LeadAction` value `'mark_lost'` that simply opens the dialog (handled in parent via `setLostLead(lead)`), so the card stays presentational.
   - Add a small destructive-styled button **"Not Interested"** (XCircle icon) to the action rows for `isNew`, `isContacted`, and `isFlagged` states.
   - Add **Book Intro** to the `isAlreadyInSystem` row (some "in system" matches are actually fine to rebook — staff currently has no path).
   - Render `<MarkLostDialog>` at the bottom; on `onDone`, call `fetchLeads()` and invalidate `['leads']`. The dialog already moves stage to `lost`, which the existing query filter (`.not('stage', 'in', '("lost","archived")')`) will hide — lead disappears from the list.

2. **`src/features/pipeline/components/PipelineNewLeadsTab.tsx`**
   - Mirror the same change (same card pattern lives there) so behavior is consistent between My Day and Pipeline.

3. **`src/components/ActionBar.tsx` (`LeadActionBar`)**
   - Add an optional `onMarkLost?: () => void` prop.
   - Render a "Not Interested" button (destructive styling, XCircle icon) when `stage` is `new` or `contacted` and the prop is provided.
   - Wire through in `LeadCard.tsx`, `LeadListView.tsx`, `LeadKanbanBoard.tsx`, and `pages/Leads.tsx` (open the existing `MarkLostDialog` already imported there).

### Behavior

- Click **Not Interested** → `MarkLostDialog` opens with reason dropdown (Went cold / Not interested / Wrong number / Already a member / Other) → save sets `stage='lost'`, writes `lead_activities` row, lead drops off all active queues.
- Click **Book Intro** on Already-in-System → opens existing BookIntroDialog flow (same handler `onBook(lead)` already wired).

### Verification

- My Day → New Leads → Contacted tab: card shows Script · Book · Copy # · Move to New · **Not Interested**. Click Not Interested → dialog → Save → card disappears, lead row in DB has `stage='lost'`, `lost_reason` set, `lead_activities` has stage_change row.
- Same on New tab and Flagged state.
- Pipeline → New Leads tab mirrors the same buttons/behavior.
- `pages/Leads.tsx` Kanban + List views: each lead card shows Not Interested for new/contacted; same dialog flow.
- Confirm a "lost" lead is excluded from `useFollowUpData` and from MyDay counts (existing filters already handle this).

Single source of truth: all surfaces use `MarkLostDialog` → no duplicate "remove lead" logic.
