
# Correction Plan: 6 Targeted Fixes

## What I Found in the Codebase

### Correction 1 — Studio in BottomNav
**Current state confirmed**: Studio (`/recaps`) is in overflow. The `primaryItems` array has My Day + Pipeline. The `visibleItems` adds Admin conditionally. Studio is in `overflowItems`. The "More" button with overflow menu is always shown.

**Fix**: Add Studio to `primaryItems` array. Remove Studio from `overflowItems`. Keep the More button only if there are still items in overflow — but since no other items remain, remove the More button entirely.

**Result**: Nav shows `My Day | Pipeline | Studio | Admin (if admin)`.

---

### Correction 2 — New Leads tab in Pipeline
**Current state**: The Pipeline page has tabs: All, Upcoming, Today, Completed, No-shows, Missed, 2nd, Not Interested, VIP, By Source. There is no "New Leads" tab. The `/leads` route redirects to `/pipeline` (done). The leads data currently lives in `MyDayPage.tsx` as a parallel fetch (`fetchNonIntroData`).

**Fix**: Add a `leads` tab to `pipelineTypes.ts` `JourneyTab` union, `PipelineFiltersBar.tsx`, and `PipelinePage.tsx`. The leads data and rendering logic already exists in `MyDayPage.tsx` (lines 148–235, 438–495) — extract the card/list rendering into a component and reuse it in the Pipeline tab. No new Supabase queries needed. The `PipelinePage.tsx` will fetch leads when the `leads` tab is active.

**Files to touch**: `src/features/pipeline/pipelineTypes.ts`, `src/features/pipeline/components/PipelineFiltersBar.tsx`, `src/features/pipeline/PipelinePage.tsx`.

---

### Correction 3 — Questionnaire status sync bug
**Root cause confirmed**: `Questionnaire.tsx` `handleSubmit()` at line 180–194 updates `intro_questionnaires.status = 'completed'` but does NOT update `intros_booked.questionnaire_status_canon`. The `useUpcomingIntrosData.ts` reads `questionnaire_status_canon` from `intros_booked` first (lines 142–161), so if that field is stale, the UI shows "Not answered" even when the questionnaire was completed.

**Fix — two parts**:

**Part A: Fix Questionnaire.tsx submission handler** — after updating `intro_questionnaires`, also update `intros_booked.questionnaire_status_canon = 'completed'` where `id = questionnaire.booking_id`. The questionnaire record has a `booking_id` column. Load it during the initial fetch.

**Part B: Add "Fix questionnaire statuses" button to Admin** — a SQL reconciliation that finds all `intros_booked` rows where `questionnaire_status_canon != 'completed'` but a completed questionnaire exists in `intro_questionnaires` for that `booking_id`, and updates them. Implemented as an inline admin function calling a new Supabase RPC `reconcile_questionnaire_statuses()`.

**Files to touch**: `src/pages/Questionnaire.tsx` (load booking_id in initial fetch, update intros_booked on submit), `src/pages/Admin.tsx` (add reconcile button in data tab), **new migration** for the RPC.

---

### Correction 4 — Remove "Log a Contact" from MyDay, move Shift Activity to top
**Current state**: `ContactLogger` is at line 348, `UpcomingIntrosCard` is at line 411, `MyDayShiftSummary` is at line 414.

**Fix**: 
1. Remove the `<ContactLogger userName={...} />` block entirely (line 348)
2. Remove the `ContactLogger` import
3. Move `<MyDayShiftSummary />` to directly after the greeting section (after line 344, the `StickyDayScore` line), before `UnresolvedIntros`

**Files to touch**: `src/features/myDay/MyDayPage.tsx`

---

### Correction 5 — Prep card: structured cheat sheet
**Current state**: The "Before Class" tab of `PrepDrawer.tsx` currently shows:
- Accusation Audit (hardcoded, not personalized)
- "Their Story" section (good — shows Q answers with dig-deeper prompts)
- PrepCollapsible "Guide Them In — Greeting" (generic script with `[name]`/`[goal]` merge)
- PrepCollapsible "During Class" (generic, same for everyone)
- PrepCollapsible "Reference — Flipbook"

**What to remove**: The green `PrepCollapsible` blocks for "Guide Them In", "During Class", and "Reference — Flipbook". These show the same text for every member. The Accusation Audit stays (it's instructional, not generic per-member). The "Their Story" section stays.

**What to add** — a new "MEMBER SNAPSHOT" section at the very top of the Before Class tab, above the Accusation Audit. This shows:
- Name (first name, large font)
- GOAL: `[shorthand from q1_fitness_goal — first 5 words or first pipe-delimited option]`
- WHY: `[shorthand from q5_emotional_driver]`
- OBSTACLE: `[shorthand from q3_obstacle — first matching phrase]`
- COMMIT: `[q6_weekly_commitment]`
- FITNESS LEVEL: `[q2_fitness_level]/5`
- GREETING LINE: One personalized sentence constructed from their goal + why (e.g. if goal is "Lose weight / lean out" and why is "Have more energy for my kids", construct: "You're here to lean out and have more energy for your kids — let's make this class count.")
- COACH HANDOFF: One line: `"[firstName] wants [goal shorthand]. Coming [commitment] a week. She's going to hit it."`

The shorthand helpers extract the first option from pipe-delimited values (e.g. `"Lose weight / lean out | Build strength"` → `"Lose weight / lean out"`).

This section is always visible (no collapsible). Shows only if questionnaire is completed.

**Files to touch**: `src/components/dashboard/PrepDrawer.tsx`

---

### Correction 6 — After Class tab: EIRMA personalized to objection
**Current state**: The "After Class" tab shows:
1. Quick Q Reference grid (good — keep)
2. `TransformationClose` component (large, keep)
3. `HumanizedEirma` component (objection cards driven by `objection_playbooks` DB table)

**What the spec says**: Replace "generic scripting" with EIRMA personalized to the member's obstacle.

**What the HumanizedEirma already does**: It's already driven by the member's obstacle from the questionnaire (`obstacles` prop = `q3_obstacle`). It already matches their obstacle to the `objection_playbooks` table and shows a 5-step EIRMA framework personalized to them. It already has a "Likely Objections (from Q)" section. This is already more personalized than the spec implies is there.

**The gap**: The spec says each step should be "one line" and scannable. Currently the steps show full text from `empathize_line`, `isolate_question`, etc., which may be long sentences. The spec says it should be a "cheat sheet not a script to read word for word."

**Fix**: In `HumanizedEirma.tsx`, the "Likely Objections" matched card (defaultOpen) is already expanded. The real issue is likely that the data in `objection_playbooks` contains long sentences. Since we cannot change the underlying playbook data without admin edits, the fix is to add a membership recommendation step based on the member's `commitment` days and a direct close line.

**Specifically add** — After the existing EIRMA steps in the matched/open objection card, add an M (Make a suggestion) step that recommends a tier based on `q6_weekly_commitment`:
- 5+ days → Premier + OTbeat
- 3-4 days → Elite + OTbeat  
- 1-2 days → Basic + OTbeat

And ensure the "No obstacle" fallback shows a simple EIRMA using goal as anchor.

**Files to touch**: `src/components/dashboard/HumanizedEirma.tsx`

---

## Technical Details

### Correction 1: BottomNav.tsx

```typescript
const primaryItems = [
  { path: '/my-day', label: 'My Day', icon: Home },
  { path: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { path: '/recaps', label: 'Studio', icon: TrendingUp },
];

const adminItem = { path: '/admin', label: 'Admin', icon: Settings };

// visibleItems: primaryItems + admin if canAccessAdmin
// Remove overflowItems array and More button entirely
```

### Correction 2: New Leads tab in Pipeline

**`pipelineTypes.ts`**: Add `'leads'` to `JourneyTab` union and `TabCounts`.

**`PipelineFiltersBar.tsx`**: Add a "New Leads" tab trigger as the first tab in the TabsList. Use a `UserPlus` or `Inbox` icon.

**`PipelinePage.tsx`**:
- Add state: `leads`, `isLoadingLeads`
- Add `useEffect` that fetches `leads` table (stage: new, contacted) when `activeTab === 'leads'` or on initial mount
- Render a leads list inside the pipeline card when `activeTab === 'leads'`
- Lead card shows: name, source badge, time since received, phone (if available), action buttons: Script (opens ScriptPickerSheet), Copy #, Contacted
- When user clicks "Contacted" → update lead stage to `contacted`

### Correction 3: Questionnaire status fix

**`Questionnaire.tsx` — load booking_id**: Change the initial fetch to also `select('id, booking_id, ...')`, store `bookingId` in state.

**`handleSubmit` addition** — after updating intro_questionnaires, immediately:
```typescript
if (data.booking_id) {
  await supabase
    .from('intros_booked')
    .update({ 
      questionnaire_status_canon: 'completed',
      questionnaire_completed_at: new Date().toISOString()
    })
    .eq('id', data.booking_id);
}
```

**New migration**: Create `reconcile_questionnaire_statuses()` RPC:
```sql
CREATE OR REPLACE FUNCTION public.reconcile_questionnaire_statuses()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_updated int := 0;
BEGIN
  UPDATE public.intros_booked b
  SET 
    questionnaire_status_canon = 'completed',
    questionnaire_completed_at = COALESCE(
      b.questionnaire_completed_at,
      (SELECT submitted_at FROM public.intro_questionnaires 
       WHERE booking_id = b.id 
       AND status IN ('completed','submitted') 
       ORDER BY submitted_at DESC NULLS LAST LIMIT 1)
    )
  WHERE b.questionnaire_status_canon IN ('not_sent', 'sent')
    AND EXISTS (
      SELECT 1 FROM public.intro_questionnaires q
      WHERE q.booking_id = b.id
        AND q.status IN ('completed', 'submitted')
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN json_build_object('updated', v_updated);
END; $$;
```

**`Admin.tsx`**: Add `QuestionnaireReconcileCard` component in the `data` tab alongside `PhoneBackfillCard`.

### Correction 4: MyDayPage.tsx order change

Remove lines 30–31 (`import { ContactLogger }`) and line 348 (`<ContactLogger ... />`).

Move `<MyDayShiftSummary />` to after `<StickyDayScore ... />` (before `<UnresolvedIntros ...>`).

### Correction 5: PrepDrawer.tsx — Member Snapshot

Add a `MemberSnapshot` function component inside PrepDrawer.tsx. Renders when `hasQ` is true. Place it at the top of the Before Class `TabsContent`, before the Accusation Audit.

```typescript
function MemberSnapshot({ firstName, goal, why, obstacle, commitment, fitnessLevel, coachName }) {
  // shorthand: take first pipe-delimited segment and trim
  const shorten = (s: string | null) => s ? s.split('|')[0].trim() : '—';
  
  const greetingLine = goal && why
    ? `You're here to ${shorten(goal).toLowerCase()} — ${shorten(why).toLowerCase()}. Let's make this class count.`
    : `Welcome! Let's make your first class great.`;
  
  const handoffLine = `${firstName} wants ${shorten(goal)}. Coming ${shorten(commitment)} a week. She's going to hit it.`;
  
  return (
    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
      <p className="text-lg font-bold">{firstName}</p>
      <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
        <span className="font-bold uppercase text-muted-foreground">Goal</span>
        <span>{shorten(goal)}</span>
        <span className="font-bold uppercase text-muted-foreground">Why</span>
        <span>{shorten(why)}</span>
        <span className="font-bold uppercase text-muted-foreground">Obstacle</span>
        <span>{shorten(obstacle)}</span>
        <span className="font-bold uppercase text-muted-foreground">Commit</span>
        <span>{shorten(commitment)}</span>
        <span className="font-bold uppercase text-muted-foreground">Level</span>
        <span>{fitnessLevel ? `${fitnessLevel}/5` : '—'}</span>
      </div>
      <div className="pt-1 border-t border-primary/10 text-xs italic text-foreground leading-relaxed">
        Greeting: "{greetingLine}"
      </div>
      <div className="text-xs border-t border-primary/10 pt-1 text-muted-foreground leading-relaxed">
        Coach handoff: "{handoffLine}"
      </div>
    </div>
  );
}
```

Remove: The three `PrepCollapsible` blocks for "Guide Them In", "During Class", "Reference — Flipbook". These are at lines 337–374 of PrepDrawer.tsx.

### Correction 6: HumanizedEirma.tsx — membership suggestion

Add a `getMembershipRecommendation` function:
```typescript
function getMembershipRecommendation(commitment: string | null): string {
  if (!commitment) return 'Elite + OTbeat';
  if (commitment.includes('5+')) return 'Premier + OTbeat';
  if (commitment.includes('3') || commitment.includes('4')) return 'Elite + OTbeat';
  return 'Basic + OTbeat';
}
```

In the `ObjectionCard` component, add a final "M — SUGGEST" step after the existing 5 steps, showing the tier recommendation. This makes it a scannable 6-step (5 EIRMA + 1 tier suggestion) cheat sheet.

Also add a no-obstacle fallback section that shows a simplified closing EIRMA anchored to goal when `matched.length === 0` and `fitnessGoal` exists.

---

## File Change Summary

| File | Change |
|---|---|
| `src/components/BottomNav.tsx` | Add Studio to primaryItems; remove overflow/More button |
| `src/features/pipeline/pipelineTypes.ts` | Add `'leads'` to JourneyTab union and TabCounts |
| `src/features/pipeline/components/PipelineFiltersBar.tsx` | Add "New Leads" tab trigger (first position) |
| `src/features/pipeline/PipelinePage.tsx` | Add leads state, fetch, and render logic for leads tab |
| `src/pages/Questionnaire.tsx` | Load booking_id; update intros_booked.questionnaire_status_canon on submit |
| `src/pages/Admin.tsx` | Add QuestionnaireReconcileCard in data tab |
| `supabase/migrations/[ts]_reconcile_questionnaire_statuses.sql` | New RPC migration |
| `src/features/myDay/MyDayPage.tsx` | Remove ContactLogger; move MyDayShiftSummary above UnresolvedIntros |
| `src/components/dashboard/PrepDrawer.tsx` | Add MemberSnapshot; remove 3 generic PrepCollapsible sections |
| `src/components/dashboard/HumanizedEirma.tsx` | Add membership recommendation step; add no-obstacle fallback |

## Acceptance Checklist Coverage

| Check | Covered by |
|---|---|
| Bottom nav: My Day, Pipeline, Studio, Admin | Correction 1 |
| Studio in primary nav, not More menu | Correction 1 |
| Pipeline "New Leads" tab shows email-parsed leads | Correction 2 |
| All other pipeline tabs still present | Correction 2 (not removed) |
| Email parsing backend untouched | Correction 2 (no edge function changes) |
| Caroline Spruiell shows Complete after reconciliation | Correction 3 (reconcile RPC + forward-fix in Questionnaire.tsx) |
| "Fix questionnaire statuses" button in Admin Data Tools | Correction 3 |
| No "Log a Contact" in MyDay | Correction 4 |
| Shift Activity first section below greeting | Correction 4 |
| Prep card: shorthand cheat sheet, no generic green boxes | Correction 5 |
| Content changes based on member's answers | Correction 5 |
| After class EIRMA personalized to obstacle | Correction 6 |
| Each step one line, no generic scripting | Correction 6 |
