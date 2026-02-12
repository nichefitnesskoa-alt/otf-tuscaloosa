

# Comprehensive Feature Plan -- All 4 Batches

This is a large roadmap. Each batch builds on the previous one. I recommend implementing them sequentially.

---

## Batch 1: Core Fixes & Data Integrity

### 1A. Cross-Table Duplicate Detection in import-lead Edge Function
**File:** `supabase/functions/import-lead/index.ts`

Before inserting into the `leads` table (Type 1 flow), add a cross-check against `intros_booked`:
- Query `intros_booked` by phone (if `lead.phone` matches any booking's linked VIP registration phone) AND by case-insensitive first+last name match
- If a match is found, return `200` with `{ status: "already_exists", message: "Already exists in client pipeline as booking." }` instead of creating a lead
- The existing name check on line 122-128 already does a partial version of this -- enhance it to also check phone via `vip_registrations` table

Since `intros_booked` doesn't store phone numbers directly, the phone cross-check will query `vip_registrations` and `leads` for phone matches tied to bookings.

### 1B. "Clean Duplicates" Button on Leads Page
**File:** `src/pages/Leads.tsx`

- Add a `Trash2` or `Sparkles` icon button labeled "Clean Duplicates" next to the "Add Lead" button
- On click: fetch all leads with `stage = 'new'`, for each lead cross-reference `intros_booked` by `first_name + last_name` (case-insensitive via `ilike`)
- Any matches: update lead's `stage` to `'lost'` and `lost_reason` to `'Already booked in client pipeline'`
- Show a toast: `"X duplicates cleaned"` or `"No duplicates found"`

### 1C. Default List View on Leads Page
**File:** `src/pages/Leads.tsx`

- Change `useState<'kanban' | 'list'>('kanban')` to `useState<'kanban' | 'list'>('list')` on line 19

### 1D. Auto-Populate Friend Questionnaire Link in Pipeline Script Picker
**File:** `src/components/dashboard/PipelineScriptPicker.tsx`

- In the `useEffect` that fetches the questionnaire link (line 169), also check if the booking has a `paired_booking_id`
- If yes, fetch the paired booking's questionnaire slug from `intro_questionnaires` where `booking_id = paired_booking_id`
- Populate `{friend-questionnaire-link}` in the merge context automatically

Currently only `{questionnaire-link}` is populated. The `paired_booking_id` field needs to be fetched from `intros_booked` along with the booking data. Update the `ClientBooking` interface to include `paired_booking_id` and fetch it in `ClientJourneyReadOnly.tsx`.

### 1E. Lead Source Sync on Booking Link (Shift Recap)
**File:** `src/pages/ShiftRecap.tsx`

- In the `matchLeadByName` function (line 221), the lead source is already being updated via `if (leadSource) updates.source = leadSource;` on line 244
- Verify this works correctly and ensure the booking's `lead_source` is always passed through

This is already implemented. No changes needed.

---

## Batch 2: Follow-Up Queue

### 2A. Follow-Up Queue Component
**New file:** `src/components/leads/FollowUpQueue.tsx`

This component:
- Fetches all `script_send_log` entries grouped by `booking_id` and `lead_id`
- For each, determines the sequence: what category, what step was last sent, when
- Cross-references `script_templates` to find the next step in sequence by `sequence_order`
- Uses the template's `timing_note` to calculate when the next message is due
- Displays items sorted by most overdue first
- Color coding: green (on time / future), yellow (due today), red (overdue)
- Each item shows: person name, next action ("Send No-Show Text 2"), overdue indicator
- Tapping opens the script generator pre-loaded with the correct template and merge fields

### 2B. Follow-Up Queue on Leads Page
**File:** `src/pages/Leads.tsx`

- Add the `FollowUpQueue` component at the top of the page, above the metrics bar
- Make it collapsible so it doesn't overwhelm the view

### 2C. Follow-Up Queue in Navigation
**File:** `src/components/BottomNav.tsx`

- Add a badge indicator on the "Leads" nav item showing the count of overdue follow-ups (not a separate nav item, to keep the nav clean)

### 2D. Daily GroupMe Follow-Up Digest
**New file:** `supabase/functions/daily-followup-digest/index.ts`

- Edge function that runs daily at 8 AM via pg_cron
- Queries `script_send_log` joined with `script_templates` to find overdue next steps
- Groups by SA (using `sent_by` field)
- Posts formatted message to GroupMe: `"@SA_Name: 3 follow-ups due (Jamie Owens - No-Show Text 2, ...)"`
- Schedule via pg_cron SQL insert

---

## Batch 3: Client Intelligence

### 3A. Questionnaire Status Badges on Pipeline Cards
**File:** `src/components/dashboard/ClientJourneyReadOnly.tsx`

- For each journey card, query `intro_questionnaires` by `booking_id` to get status
- Display badge: gray "Not Sent", yellow "Sent", green "Completed"
- When completed, show a "View Responses" button that opens a dialog with the questionnaire answers

### 3B. Client Profile View
**New file:** `src/components/dashboard/ClientProfileSheet.tsx`

- A sheet/dialog accessible from any booking or lead card
- Shows: questionnaire responses (goals, obstacles, fitness level, commitment, coach notes), current status, booking history, run history
- One-tap access from pipeline cards and lead cards

### 3C. Intro Prep Button
**File:** `src/components/dashboard/ClientJourneyReadOnly.tsx`

- Add an "Intro Prep" button to each booking in the expanded view
- Opens a clean, phone-friendly card showing: client name (large), questionnaire highlights, class time, "Copy to Clipboard" button

### 3D. Objection Playbooks
**New file:** `src/components/dashboard/ObjectionPlaybook.tsx`

- Auto-generates coaching cards based on questionnaire responses
- Maps obstacles (e.g., "Cost") to specific talking points
- Displayed in the booking detail view / client profile

### 3E. "Referred By" Field + Top Referrers
**Database:** Add `referred_by_member_name` column to `intros_booked`
**File:** `src/components/IntroBookingEntry.tsx`

- Show a "Referred By" input when lead source is "Member Referral"
- When filled, auto-creates a referral record linking the referring member
- Admin panel: new "Top Referrers" leaderboard component showing members ranked by referral count and conversion count

### 3F. Referral Tree Visualization
**New file:** `src/components/admin/ReferralTree.tsx`

- Query `referrals` table and follow chains via `referrer_booking_id` / `referred_booking_id`
- Display as a tree/chain view showing multi-level referrals
- Add to the Admin Referrals tab

---

## Batch 4: Analytics & Automation

### 4A. "My Day" Homepage
**New file:** `src/pages/MyDay.tsx`

- Replaces shift recap as default landing after login
- Sections: (1) Today's booked intros with questionnaire status, (2) Overdue follow-ups for this SA, (3) New uncontacted leads, (4) Quick-start shift recap button
- Each item tappable to relevant action
- Update `App.tsx` routes: `/` and login redirect go to `/my-day`, shift recap stays at `/shift-recap`

### 4B. Campaigns Section
**Database:** New `campaigns` table (id, name, start_date, end_date, offer_description, target_audience, created_at) and `campaign_sends` junction table
**New files:** `src/components/admin/CampaignsPanel.tsx`, `src/components/admin/CampaignDashboard.tsx`

- Admin panel tab for creating/managing campaigns
- Link script sends to campaigns via tagging
- Track: scripts sent per campaign, referrals generated, conversions
- Simple funnel dashboard

### 4C. Coaching View
**New file:** `src/components/admin/CoachingView.tsx`

- Scatter plots: close rate vs goal/why rate, close rate vs made-a-friend rate, etc.
- Auto-generated coaching suggestions based on metric patterns
- Uses recharts (already installed) for visualization
- Added as a new tab in Admin panel

### 4D. Real-Time Lead Alerts
**Database:** Add `lead_alert_enabled` column to `staff` table
**File:** `supabase/functions/import-lead/index.ts`

- After creating a new lead, check which SAs have alerts enabled
- Use Supabase Realtime on the `leads` table for in-app notifications
- Add notification bell component to header
- "Lead Alert" toggle in user settings

### 4E. Sale Celebration GroupMe Post
**File:** `src/pages/ShiftRecap.tsx` or `src/lib/groupme.ts`

- When a shift recap includes a membership sale, post an additional celebratory GroupMe message
- Format: "SALE! {sa-name} just closed {member-name} on {membership-type}! That's X sales this pay period."
- Query `intros_run` and `sales_outside_intro` for pay period totals

### 4F. Weekly Digest
**New file:** `supabase/functions/weekly-digest/index.ts`

- Edge function scheduled via pg_cron for Monday 7 AM
- Calculates: last week's metrics, comparison to 400 AMC target, top 3 performers, overdue follow-ups count, this week's booked intros
- Posts to GroupMe and saves as viewable report in admin

---

## Database Changes Required

| Change | Table | Details |
|--------|-------|---------|
| Add column | `intros_booked` | `referred_by_member_name TEXT` |
| Add column | `staff` | `lead_alert_enabled BOOLEAN DEFAULT false` |
| New table | `campaigns` | id, name, start_date, end_date, offer_description, target_audience, created_at |
| New table | `campaign_sends` | id, campaign_id (FK), send_log_id (FK), created_at |
| New table | `weekly_digests` | id, week_start, report_json, created_at |
| Realtime | `leads` | Enable realtime for lead alerts |

---

## New Files Summary

| File | Purpose |
|------|---------|
| `src/components/leads/FollowUpQueue.tsx` | Follow-up queue with overdue tracking |
| `src/components/leads/CleanDuplicatesButton.tsx` | Cross-table duplicate cleaner |
| `src/components/dashboard/ClientProfileSheet.tsx` | Client profile view |
| `src/components/dashboard/ObjectionPlaybook.tsx` | Auto-generated coaching cards |
| `src/components/dashboard/IntroPrepCard.tsx` | Quick prep card for intros |
| `src/components/admin/ReferralTree.tsx` | Referral chain visualization |
| `src/components/admin/CampaignsPanel.tsx` | Campaign management |
| `src/components/admin/CampaignDashboard.tsx` | Campaign performance dashboard |
| `src/components/admin/CoachingView.tsx` | SA coaching analytics |
| `src/pages/MyDay.tsx` | "My Day" homepage |
| `supabase/functions/daily-followup-digest/index.ts` | Daily 8 AM GroupMe digest |
| `supabase/functions/weekly-digest/index.ts` | Monday 7 AM weekly report |

---

## Implementation Order

1. Batch 1 first (core fixes, quick wins)
2. Batch 2 (Follow-Up Queue -- high impact for daily operations)
3. Batch 3 (Client intelligence -- improves close rates)
4. Batch 4 (Analytics & automation -- operational excellence)

Each batch will be implemented as a series of changes, tested, and then the next batch begins.

