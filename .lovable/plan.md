

# Fix Tooltips → Subtitles, Permanent Leads Section, Win the Day Grouping

## Summary
Three fixes: (1) Replace all `SectionTooltip` hover popovers with always-visible subtitle text lines. (2) Make the New Leads section permanently visible with an empty state. (3) Group Win the Day items into three collapsible sub-groups.

## FIX 1 — Replace Tooltips with Subtitles

**Delete** `src/components/shared/SectionTooltip.tsx`

**Remove** all `<SectionTooltip>` usage and replace with a `<p>` subtitle line below each header. Files affected:

| File | Current SectionTooltip | Replacement subtitle text |
|---|---|---|
| `MyDayPage.tsx` (line 266) | Remove from h1, add `<p>` below the date line | "Your shift home. Tasks, intros, and new leads — everything for this shift." |
| `ShiftChecklist.tsx` (line 213) | Add subtitle below the SELECT label | "Your responsibilities for this shift. Complete these in order." |
| `UpcomingIntrosCard.tsx` (line 313) | Remove from CardTitle, add `<p>` below | "First-timers today. Prep them before class. Book in Mindbody AND here." |
| `Wig.tsx` (line 389) | Remove from h1, add `<p>` below | "The scoreboard. Your lead measures and the studio's quarterly targets." |
| `CoachView.tsx` (line 190) | Remove from h1, add `<p>` below | "Your intro cards. Prep before class. Debrief after." |
| `Recaps.tsx` (line 182) | Remove from h1, add `<p>` below | "Analytics and performance data for the studio." |
| `PipelinePage.tsx` (line 95) | Remove from h1, add `<p>` below | "Full lead history and booking edits. For fixes and research — not daily workflow." |

All subtitles: `text-xs text-muted-foreground` — always visible, plain text, no interaction.

Also add subtitles for the Follow-Up and Week tabs inside `MyDayPage.tsx` tab content areas:
- Follow-Up tab content: "People who didn't buy yet. One touch per person, every day."
- Week tab content: "Upcoming intros this week. Send confirmation texts from here."

## FIX 2 — Permanent New Leads Section

**Modify** `src/features/myDay/NewLeadsAlert.tsx`:

- Change cutoff from 24 hours to 48 hours
- Remove the early return `if (loading || leads.length === 0) return null` — always render
- When loading: show section header with skeleton
- When no leads: show gray neutral card with header "New Leads" and subtitle "No new leads right now. When one comes in, it appears here first." — `border-muted bg-muted/10` styling
- When leads exist: keep current amber styling with "New Leads — Respond Now" header
- Section renders immediately with header before data loads

## FIX 3 — Win the Day Grouping

**Modify** `src/features/myDay/WinTheDay.tsx`:

Group items into three sub-groups based on `item.type`:

| Group | Label | Types included | Collapse rule |
|---|---|---|---|
| Send Questionnaires | "Send Questionnaires — X remaining" | `q_send`, `q_resend` | Collapsed if >3 incomplete items |
| Prep & Role Play | "Prep & Role Play — X remaining" | `prep_roleplay`, `log_outcome` | Collapsed if >3 incomplete items |
| Confirmations & Follow-Up | "Confirmations & Follow-Up — X remaining" | `confirm_tomorrow`, `followups_due`, `leads_overdue`, `log_ig`, `cold_texts`, `cold_dms` | Always expanded |

Each group header shows mini progress: "2 of 6 complete"

Implementation:
- After fetching items, partition into three arrays by type
- Render each group as a `Collapsible` with its own header showing group name, remaining count, and mini progress
- Top-level progress bar and incomplete count badge unchanged
- `ChecklistRow` rendering unchanged — just wrapped in groups
- Completed items within each group shown at bottom of that group (not in a separate "Completed" dropdown)

## Files Modified
1. `src/components/shared/SectionTooltip.tsx` — delete
2. `src/features/myDay/MyDayPage.tsx` — remove SectionTooltip import/usage, add subtitle lines
3. `src/features/myDay/ShiftChecklist.tsx` — add subtitle
4. `src/features/myDay/UpcomingIntrosCard.tsx` — remove SectionTooltip, add subtitle
5. `src/pages/Wig.tsx` — remove SectionTooltip, add subtitle
6. `src/pages/CoachView.tsx` — remove SectionTooltip, add subtitle
7. `src/pages/Recaps.tsx` — remove SectionTooltip, add subtitle
8. `src/features/pipeline/PipelinePage.tsx` — remove SectionTooltip, add subtitle
9. `src/features/myDay/NewLeadsAlert.tsx` — always-visible section with empty state
10. `src/features/myDay/WinTheDay.tsx` — grouped sub-sections

## Subsequent Changes
1. Removing `SectionTooltip.tsx` is safe — no other components use it beyond the 7 listed files
2. New Leads 48-hour cutoff means leads stay visible longer — same query, just extended window
3. Win the Day grouping is display-only — same items, same completion logic, same reflections
4. "Send Script" in New Leads still logs to `lead_activities` via the existing script send flow
5. No database changes needed

