Don't build 1G  
  
Universal Inline Editing — Implementation Plan

## Scope

6 sections, ~30 inline edit points across 5 main files. One reusable inline edit component to standardize the pattern. No DB migration needed.

---

## Technical Approach

### Shared InlineEditField Component

Create `src/components/shared/InlineEditField.tsx` — a generic reusable component that handles all the inline editing patterns described:

```
InlineEditField<T> props:
  - value: string | number | null
  - placeholder: string (e.g. "Add phone")
  - type: 'text' | 'tel' | 'email' | 'number' | 'time' | 'select' | 'toggle'
  - options?: { value: string; label: string }[] (for select type)
  - onSave: (newValue: T) => Promise<void>
  - displayFormatter?: (val: T) => string
  - disabled?: boolean
  - className?: string
```

Behavior:

- Display mode: shows value or muted italic placeholder. Subtle pencil icon on hover.
- Edit mode: replaces with appropriate `<input>` or `<select>`. Focused immediately.
- Save: on blur or Enter for inputs, on change for selects, on click for toggles.
- Cancel: Escape key reverts without saving.
- Success: brief green checkmark flash (CSS transition, ~1s), no toast.
- Error: red border on field + error toast. Input stays open.

This component will be imported everywhere instead of duplicating edit logic.

---

## Section 1 — MyDay Intro Cards

**File: `src/features/myDay/IntroRowCard.tsx**`

### 1A — Phone (lines 427-437)

Current: Red "Phone missing — add before class" badge is not tappable. Existing phone is static text.

Change:

- Replace the non-tappable badge and static phone display (lines 428-437) with `InlineEditField` type="tel"
- When no phone: shows muted italic "Add phone" placeholder
- When phone exists: shows formatted phone as tappable text
- On save: `supabase.from('intros_booked').update({ phone: val, phone_e164: '+1' + stripped }).eq('id', item.bookingId)` then `onRefresh()`
- Display uses `formatPhoneDisplay()`

### 1B — Email (new, after phone line ~line 437)

Current: No email field shown at all.

Change:

- Add `InlineEditField` type="email" below phone
- When no email: muted italic "Add email"
- When email exists: tappable text showing truncated email
- On save: `supabase.from('intros_booked').update({ email: val }).eq('id', item.bookingId)`

### 1C — Class time (lines 360-407)

Current: Already has inline time editor with `editingTime` state and `<input type="time">`. This is already working.

Change: Refactor to use `InlineEditField` type="time" for consistency, keeping the same save logic. Or leave as-is since it already works — verify only.

### 1D — Coach (lines 409-413)

Current: `InlineCoachPicker` exists but only activates when coach is "TBD" or null (line 409). When coach has a value, it's static text (line 412).

Change: Make the existing coach name (line 412) also tappable — wrap in a `<button>` that triggers `InlineCoachPicker` editing mode. The `InlineCoachPicker` component (lines 24-71) already handles the select/save/blur pattern — just need to make it always tappable, not just when TBD.

### 1E — SA/Owner (lines 414-422)

Current: Shows SA name as static text with a User icon.

Change: Replace static `<span>` with `InlineEditField` type="select" with `ALL_STAFF` options. When no owner: show "Add SA" in muted italic. On save: `supabase.from('intros_booked').update({ intro_owner: val }).eq('id', item.bookingId)`

### 1F — Lead source (lines 438-442)

Current: Shows lead source as a static `<Badge variant="outline">`.

Change: Replace with `InlineEditField` type="select" using `LEAD_SOURCES` from `@/types`. Renders as tappable badge. On save: `supabase.from('intros_booked').update({ lead_source: val }).eq('id', item.bookingId)`

### 1H — Outcome (lines 652-678)

Current: Already tappable — the outcome banner at the bottom is wrapped in a `<button>` that opens `OutcomeDrawer` (line 653). This is already working correctly.

No changes needed.

---

## Section 2 — Pipeline Expanded Rows

**File: `src/features/pipeline/components/PipelineSpreadsheet.tsx**`

### Current state (lines 543-758)

`ExpandedRowDetail` already has:

- Inline owner edit (lines 564, 583-607) — working
- Inline lead source edit (lines 565, 622-642) — working
- Inline commission edit (lines 566-567, 694-727) — working, admin only
- Tappable outcome badge (lines 682-693) — opens `edit_run` dialog

### 2A — Phone (line 576-579)

Current: Shows phone as static text with copy button.

Change: Replace with `InlineEditField` type="tel". When missing: "Add phone" placeholder. On save: update `intros_booked.phone` for the latest booking.

### 2B — Email (line 581)

Current: Shows email as static text or nothing.

Change: Replace with `InlineEditField` type="email". When missing: "Add email" placeholder. On save: update `intros_booked.email` for the latest booking.

### 2C-2F — Already implemented

Lead source (2C), SA/Owner (2D), Outcome (2E), Commission (2F) are already working as inline edits. No changes needed except adding the `InlineEditField` visual treatment (hover pencil, green checkmark flash) for consistency.

---

## Section 3 — Referral Leaderboard

**File: `src/components/dashboard/ReferralLeaderboard.tsx**`

### 3A — Mark as Purchased button

Current state needs to be verified. The previous session added this. If already working, no changes. If not, add inline "Mark Purchased" button on Pending entries that updates `referrals` table.

### 3B — Auto-detect on purchase log

**File: `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts**`

After saving a purchase outcome (when `result_canon === 'PURCHASED'`):

- Query `intros_booked` for the booking's `referred_by_member_name`
- If present, query `referrals` table for matching `referred_name` 
- If found with `discount_applied === false`, update to `discount_applied = true`
- `console.log('Auto-detected referral purchase for:', referrerName)`

---

## Section 4 — Follow Up Queue

**File: `src/components/dashboard/FollowUpsDueToday.tsx**`

Need to read this file to understand current rendering of individual follow-up items before specifying changes.

### 4A — Scheduled date

Add `InlineEditField` type="date" on the scheduled date display. On save: `supabase.from('follow_up_queue').update({ scheduled_date: val }).eq('id', itemId)`

### 4B — Notes

Add `InlineEditField` type="text" (or a textarea variant) for notes. When empty: "Add note" placeholder. On save: update `follow_up_queue` notes field. Note: The `follow_up_queue` table doesn't have a `notes` column per the schema — it has `primary_objection` and `fitness_goal`. Will add notes to the `followup_touches` table instead, or skip if the column doesn't exist.

Actually, looking at the schema: `follow_up_queue` doesn't have a `notes` column. The `followup_touches` table has `notes`. For the follow-up queue cards, we'll make the `primary_objection` field tappable to edit since that's the most useful field to correct inline.

### 4C — Mark complete

Verify the existing "Mark Done" / "Sent" buttons work without page refresh. The `FollowUpsDueToday` component likely handles this already via optimistic updates.

---

## Section 5 — Leads List

**File: `src/components/leads/LeadListView.tsx**`

### 5A — Phone (lines 203-206)

Current: Shows phone as a `tel:` link.

Change: Replace with `InlineEditField` type="tel". Tap opens inline input. On save: `supabase.from('leads').update({ phone: val }).eq('id', lead.id)` + `onRefresh()`

### 5B — Email

Current: No email column shown in the table.

Change: Add an Email column to the table header and body. Use `InlineEditField` type="email". When missing: "Add email" placeholder.

### 5C — Lead source

Current: Not shown in the leads table (source is passed to `LeadActionBar` but not displayed as a column).

Change: The `leads` table uses `source` not `lead_source`. Add inline editing via `LeadActionBar` or add a visible column. Since the table is already wide, add source editing to the lead detail sheet instead, or make the name cell show source as a small badge below. For minimal table disruption: add source as a tappable badge in the Name cell.

### 5D — Stage (lines 208-220)

Current: Already an inline `<Select>` dropdown that calls `onStageChange`. This is already working.

No changes needed.

---

## Section 6 — Win the Day Buttons

**File: `src/features/myDay/WinTheDay.tsx**`

### Current state

Reviewed the `handleAction` callback (lines 96-163). All buttons already perform direct actions or navigation:

- `q_send`/`q_resend`: copies Q link + navigates to card (lines 98-114)
- `prep_roleplay`: navigates to card + opens prep drawer (lines 116-126)
- `confirm_tomorrow`: navigates to week tab + scrolls to card (lines 128-137)
- `followups_due`: switches to followups tab (line 140-141)
- `leads_overdue`: switches to newleads tab (line 143-145)
- `log_ig`: switches to igdm tab (line 147-149)
- `shift_recap`: clicks end-shift trigger (line 151-153)
- `cold_texts`/`cold_dms`: opens outreach reflection drawer (lines 156-161)

**Audit result**: No "navigate to X" toasts found in the action handlers. The `handleDirectComplete` function (lines 51-76) uses `toast.success()` only for confirming an action was done (e.g., "Prepped [name]"), not instructional "go to X" toasts.

**Changes needed**: 

- `confirm_tomorrow` (line 130): after scrolling to the card, also dispatch `myday:open-script` to auto-open the script picker for confirmations
- Verify no toast anywhere says "navigate" or "go to" — search codebase

---

## New Files


| File                                        | Purpose                                          |
| ------------------------------------------- | ------------------------------------------------ |
| `src/components/shared/InlineEditField.tsx` | Reusable inline edit component with all patterns |


## Modified Files


| File                                                       | Changes                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/features/myDay/IntroRowCard.tsx`                      | 1A phone, 1B email, 1D coach always-tappable, 1E SA, 1F lead source, 1G confirmation toggle |
| `src/features/pipeline/components/PipelineSpreadsheet.tsx` | 2A phone, 2B email inline edits in expanded rows                                            |
| `src/components/leads/LeadListView.tsx`                    | 5A phone inline edit, 5B email column + inline edit                                         |
| `src/lib/domain/outcomes/applyIntroOutcomeUpdate.ts`       | 3B referral auto-detection on purchase                                                      |
| `src/features/myDay/WinTheDay.tsx`                         | Confirm button also opens script picker                                                     |
| `src/components/dashboard/FollowUpsDueToday.tsx`           | 4A date edit, 4B objection edit, 4C verify mark complete                                    |


---

## Implementation Priority

If time runs low:

1. `InlineEditField` component (foundation for everything)
2. Section 1 — MyDay cards (highest user impact)
3. Section 5 — Leads list
4. Section 2 — Pipeline expanded rows
5. Section 3 — Referral auto-detect
6. Section 4 — Follow up queue
7. Section 6 — Win the Day audit