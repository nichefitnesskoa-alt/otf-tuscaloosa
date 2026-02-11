

# Auto-Link Web Leads to Shift Recap Bookings and Sales

## The Problem

When someone fills out a web form (e.g., Orangebook), they appear as a "new" lead in your Leads Pipeline. But if your team has already booked them (or they've already purchased) via the Shift Recap, those leads sit there looking unactioned because the two systems don't talk to each other.

## The Solution

Two-pronged automatic matching:

1. **On Shift Recap submission** -- After a booking or sale is created, the system checks the `leads` table for a matching name. If found, it auto-links the lead (sets `booked_intro_id`) and advances the stage to `booked` (or `won` for purchases). No double entry needed.

2. **On new web lead arrival** -- When the `import-lead` edge function creates a new lead, it checks if that person already has an active booking in `intros_booked` (or a completed sale in `intros_run`). If so, it auto-links and sets the correct stage immediately, so the lead never shows up as "new."

3. **Visual indicator on Leads page** -- Leads that were auto-linked show a small badge (e.g., "Already Booked" in green or "Purchased" in gold) so your team knows at a glance they don't need action.

---

## Technical Details

### 1. Shift Recap Submission -- Match Leads on Booking/Sale Creation

**File: `src/pages/ShiftRecap.tsx`**

After each `intros_booked` insert (around line 266), add a lead-matching step:

- Query `leads` table for matching `first_name` + `last_name` (case-insensitive) where `booked_intro_id IS NULL` and `stage != 'lost'`
- If a match is found:
  - Update `leads.booked_intro_id` to the new booking ID
  - Update `leads.stage` to `'booked'`
  - Insert a `lead_activities` record noting "Auto-linked from shift recap booking"

After each sale (both intro-run sales around line 500 and outside-intro sales around line 595), add a similar check:

- Query `leads` for matching name where stage is not already `'won'`
- If matched: update stage to `'won'`, log activity "Auto-linked: membership purchased"

### 2. Import-Lead Edge Function -- Check Existing Bookings

**File: `supabase/functions/import-lead/index.ts`**

For Type 1 (web lead) flow, after the existing duplicate-detection block but before inserting the new lead:

- Query `intros_booked` for a matching `member_name` (case-insensitive) where `deleted_at IS NULL`
- If a booking exists:
  - Still create the lead (for contact info tracking), but set `stage = 'booked'` and `booked_intro_id` to the booking ID
  - Also check `intros_run` for that booking to see if there's a sale result -- if so, set `stage = 'won'`
- This way the lead is created but immediately categorized correctly

### 3. Visual Badges on Lead Cards

**File: `src/components/leads/LeadCard.tsx`**

- If `lead.booked_intro_id` is set and `lead.stage === 'booked'`, show a green "Already Booked" badge
- If `lead.stage === 'won'`, show a gold "Purchased" badge
- These badges make it immediately obvious that no further action is needed

### 4. Auto-Filter from "New" Column

**File: `src/components/leads/LeadKanbanBoard.tsx`**

The kanban already filters out leads with `booked_intro_id` set (line 25: `leads.filter(l => !l.booked_intro_id)`). So once auto-linked, these leads disappear from the active pipeline automatically. No change needed here -- this already works correctly once the linking happens.

---

## File Summary

| Action | File | What Changes |
|--------|------|-------------|
| Edit | `src/pages/ShiftRecap.tsx` | Add lead-matching after booking inserts and sale inserts |
| Edit | `supabase/functions/import-lead/index.ts` | Check `intros_booked` before creating lead; set correct stage |
| Edit | `src/components/leads/LeadCard.tsx` | Add "Already Booked" / "Purchased" badge |

