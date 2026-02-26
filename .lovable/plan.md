Everything is good with this as the only things that i want to make sure about  
  
**Change 2 — AI Panel** It says "all state and handlers already exist" — this is only true if the previous session successfully wired them. If that session had errors, the handlers may not actually be there and the JSX will break. If Lovable flags any missing references, tell it to add the handlers too.

**Change 6 — Outcome re-selector** The plan says "most practical: add an Edit Outcome dropdown item — already exists on line 625." That's not what we asked for — we wanted tappable outcome badge that opens the re-selector. Make sure it actually opens the outcome bottom sheet via `applyIntroOutcomeUpdate`, not just a dropdown.

---

**One thing missing from the plan:**

The plan doesn't mention updating `IntroDayGroup.tsx` to pass `focusedBookingId` down — it mentions it in Change 4 description but it's not in the files changed summary table. It should be there. Not a blocker since it's referenced in the body, just confirm it actually makes the change.  
  
Implementation Plan — Changes 1-7

## Scope Summary

7 changes across 8 files modified and 1 DB migration. Prioritized order: Change 1 → 4 → 5 → 7 → 2 → 3 → 6.

---

## Change 1: Update AI Script Generator System Prompt

**File: `supabase/functions/generate-script/index.ts**`

- Replace the `KOA_SYSTEM_PROMPT` constant (lines 8-19) with the full verbatim prompt provided. This is a direct string replacement — no logic changes.
- The new prompt is significantly longer (~2500 chars) and includes voice rules, anti-patterns, objection handling patterns, and example scripts.

## Change 2: AI Panel Drawer JSX in ScriptPickerSheet

**File: `src/components/scripts/ScriptPickerSheet.tsx**`

- Add a new `<Drawer>` component at the bottom of the JSX (after the `MessageGenerator` section, around line 382)
- Opens when `aiPanelOpen === true`
- Contents:
  - Title: "✨ AI Script Generator" with sub-label
  - Script category `<Select>` dropdown with 8 options: confirmation, questionnaire send, follow-up touch 1/2/3, no-show outreach, objection handling, general
  - Read-only context panel showing Name, Goal, Objection from `memberCtx`
  - Orange "Generate Script" `<Button>` calling existing `handleAiGenerate()`
  - "Regenerate" `<Button>` (calls `handleAiGenerate()` again)
  - Generated script in `<Textarea>` with `value={aiScript}` + `onChange` for editability
  - "Use This Script" `<Button>` calling existing `handleUseAiScript()`
  - "Cancel" `<Button>` closing the panel
  - Loading spinner (`<Loader2 className="animate-spin">`) shown during `aiGenerating`
- Import `Textarea` from `@/components/ui/textarea` and `Loader2` from `lucide-react`
- All state and handlers already exist (`aiPanelOpen`, `aiGenerating`, `aiScript`, `aiCategory`, `handleAiGenerate`, `handleUseAiScript`) — this is purely a JSX addition.

## Change 3: Prep Drawer Full Redesign

**DB Migration:**

- Add `shoutout_consent` boolean column to `intros_booked`, default null

**File: `src/components/dashboard/PrepDrawer.tsx` (complete rewrite of content sections)**

The existing file has ~653 lines with SA/Coach content in two tabs (Before Class / After Class). The redesign replaces both tabs with a single scrollable view with SA sections, then Coach sections.

**SA Card Content (screen view):**

1. **Transformative one-liner** — already exists (lines 302-314), keep with minor text change
2. **Shoutout consent** — NEW. Amber card with radio-style buttons. Tapping saves `shoutout_consent` to `intros_booked` via Supabase immediately
3. **Dig Deeper** — Replace current bullet-point checklist (lines 344-400) with conversation flow waypoints format as specified
4. **Risk Free Guarantee** — already exists (lines 418-429), update text to match exact wording
5. **Studio Trend** — NEW section for 1st intros only. Query `intros_run` for current pay period, find most common `primary_objection`, display with plain English tip

**Coach Card Content (screen view):**

- For 2nd intros: "FROM THEIR FIRST VISIT" section at very top in orange (query originating booking's run data)
- Quick snapshot: Name, Time, Level, Goal, Coach
- Pre-entry announcement: static text with name interpolated
- In-class actions: 3 bullets auto-generated from goal type + fitness level using lookup tables for 6 goal categories
- Peak moment callout: Only shown when `shoutout_consent === true`. Shows only the matching goal category
- Closing celebration: Only when `shoutout_consent === true`
- Performance summary: Two options shown, both populated from questionnaire data

**State additions to PrepDrawer:**

- `shoutoutConsent: boolean | null` — loaded from `intros_booked.shoutout_consent`
- `savingConsent: boolean` — loading state for save
- `studioTrend: { objection: string; percent: number } | null` — from pay period query
- `prevVisitData` — for 2nd intro coach card (query originating booking's run + Q)

**Print layout:**

- Replace existing print-only div (lines 562-605) with the two-half layout
- Top half: SA Prep with name/date/time header, one-liner, shoutout consent checkboxes, dig deeper waypoints, RFG
- Cut line: `✂ ─ ─ ─ COACH COPY ─ [NAME] | [TIME] | Level [X]/5`
- Bottom half: Coach content with pre-entry, in-class actions, peak moment (if consent), closing (if consent), performance summary
- CSS: `@media print` rules — `font-size: 11px`, `max-height: 100vh`, hide drawer chrome

**Goal-to-actions mapping (static lookup):**

```
GOAL_ACTIONS = {
  fat_loss: [...3 bullets],
  build_muscle: [...3 bullets],
  energy: [...3 bullets],
  confidence: [...3 bullets],
  wedding: [...3 bullets],
  getting_back: [...3 bullets],
}
```

Goal detection: regex match on `q1_fitness_goal` text to map to category.
Fitness level rules appended based on `q2_fitness_level`.

## Change 4: A6 Focus Mode 2 Hours Before Intro

**File: `src/features/myDay/IntroRowCard.tsx**`

Add new state and effect:

- `minutesUntilClass: number | null` computed from `item.classDate + item.introTime`
- `useEffect` with 60-second `setInterval` to recompute
- New prop: `isFocused?: boolean` (passed from parent)
- When `isFocused && minutesUntilClass <= 120 && minutesUntilClass > 0`:
  - Add `ring-2 ring-orange-500` to card outer div with `style={{ animationDuration: '3s' }}` and `animate-pulse`
  - Show countdown badge: `<Badge>🕐 Class in {hours}h {mins}m</Badge>` in amber color, positioned after the name
  - If `!prepped`: Prep button gets `animate-pulse bg-orange-500 text-white`
- When not focused but another card is: `opacity-80` on card outer div

**File: `src/features/myDay/IntroRowCard.tsx` — interface update:**

- Add `isFocused?: boolean` to `IntroRowCardProps`

**File: `src/features/myDay/IntroDayGroup.tsx**`

- Add `focusedBookingId?: string | null` prop
- Pass `isFocused={item.bookingId === focusedBookingId}` to each `IntroRowCard`

**File: `src/features/myDay/UpcomingIntrosCard.tsx**`

- Compute `focusedBookingId`: find the item with the nearest `introTime` where `classDate === todayStr` and `minutesUntilClass <= 120 && minutesUntilClass > 0`
- Pass `focusedBookingId` to `IntroDayGroup`

## Change 5: A7 Q Escalation 3 Hours Before Class

**File: `src/features/myDay/IntroRowCard.tsx**`

In the Q status banner section (lines 270-281), add a condition:

- When `!item.isSecondIntro && localQStatus === 'Q_SENT' && minutesUntilClass !== null && minutesUntilClass <= 180 && minutesUntilClass > 0`:
  - Override banner to red: `<StatusBanner bgColor="#dc2626" text="🔴 Questionnaire Overdue — Class in Xh Xm" />`
  - Override `borderColor` to `'#dc2626'`

**File: `src/features/myDay/useWinTheDayItems.ts**`

In the `q_resend` section (lines 211-226):

- Change the condition: currently only shows resend if `minutesUntil > 120`. When `minutesUntil <= 180`, instead:
  - Set `urgency: 'red'`
  - Set `sortOrder: 50` (highest priority, above everything)
  - Change text to: `"⚠ ${intro.member_name}'s questionnaire still not answered — class in ${timeLabel}"`

## Change 6: E4 Inline Editing on Pipeline Expanded Rows

**File: `src/features/pipeline/components/PipelineSpreadsheet.tsx**`

In `ExpandedRowDetail` (lines 543-654):

**Lead Source inline edit:**

- In booking row (line 582): replace static `{b.lead_source}` with a tappable element
- On tap: show inline `<select>` with standard lead sources (Member Referral, Online Intro Offer, Walk-in, IG DM, etc.)
- On change: `supabase.from('intros_booked').update({ lead_source: val }).eq('id', b.id)` + refresh

**SA/Owner inline edit:**

- In line 569 where `journey.latestIntroOwner` is shown: make tappable
- On tap: show inline `<select>` with ALL_STAFF names
- On change: `supabase.from('intros_booked').update({ intro_owner: val }).eq('id', b.id)` + refresh

**Outcome re-selector:**

- On the `OutcomeBadge` in runs section (line 622): make it a button
- On click: dispatch `myday:open-outcome` event or open inline outcome selector
- Most practical: add an "Edit Outcome" dropdown item (already exists on line 625 as edit button)

**Commission inline edit (admin only):**

- Next to `${r.commission_amount}` (line 623): if user is admin, make tappable
- On tap: show inline `<input type="number">` 
- On blur: `supabase.from('intros_run').update({ commission_amount: val }).eq('id', r.id)` + refresh

Use consistent inline editing pattern: `useState` for each editing field, tappable text → select/input → save on change.

## Change 7: StudioIntelligenceCard MyDay + Admin Integration

**File: `src/features/myDay/MyDayPage.tsx**`

- Import `StudioIntelligenceCard` from `@/components/admin/StudioIntelligenceCard`
- Import `useAuth` (already imported)
- Check if user has admin role: query `user_roles` table on mount for `role === 'admin'`
- Add state: `isAdmin: boolean`, `intelligenceDismissed: boolean` (from localStorage with today's date key)
- Render above `<WinTheDay>` (before line 330): if `isAdmin && !intelligenceDismissed`, show `<StudioIntelligenceCard dismissible onDismiss={() => { localStorage.setItem('si-dismissed-' + todayStr, 'true'); setIntelligenceDismissed(true); }} />`

**File: `src/pages/Admin.tsx**`

- Import `StudioIntelligenceCard`
- Add new tab "Intelligence" to the `TabsList` (change `grid-cols-7` to `grid-cols-8`)
- Add `<TabsTrigger value="intelligence">` with `<Brain>` icon
- Add `<TabsContent value="intelligence">` rendering `<StudioIntelligenceCard />`

---

## DB Migration

Single migration with:

```sql
ALTER TABLE public.intros_booked ADD COLUMN IF NOT EXISTS shoutout_consent boolean DEFAULT NULL;
```

---

## Files Changed Summary


| File                                                       | Changes                              |
| ---------------------------------------------------------- | ------------------------------------ |
| `supabase/functions/generate-script/index.ts`              | Replace system prompt verbatim       |
| `src/components/scripts/ScriptPickerSheet.tsx`             | Add AI panel Drawer JSX              |
| `src/components/dashboard/PrepDrawer.tsx`                  | Full content redesign + print layout |
| `src/features/myDay/IntroRowCard.tsx`                      | Focus mode (A6) + Q escalation (A7)  |
| `src/features/myDay/IntroDayGroup.tsx`                     | Pass focusedBookingId prop           |
| `src/features/myDay/UpcomingIntrosCard.tsx`                | Compute focusedBookingId             |
| `src/features/myDay/useWinTheDayItems.ts`                  | Q overdue escalation to top          |
| `src/features/myDay/MyDayPage.tsx`                         | StudioIntelligenceCard for admins    |
| `src/features/pipeline/components/PipelineSpreadsheet.tsx` | Inline editing in expanded rows      |
| `src/pages/Admin.tsx`                                      | Daily Intelligence tab               |
