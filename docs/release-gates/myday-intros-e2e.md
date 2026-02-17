# My Day Intros – Manual E2E Checklist

## Pre-flight
- [ ] `bun run test` passes (all vitest suites green)
- [ ] `bun run typecheck` or `tsc --noEmit` passes
- [ ] No console errors on /my-day load

## Old UI Removal
- [ ] No "Tomorrow's Intros" section visible
- [ ] No "This Week's Intros" section visible
- [ ] SectionReorder dialog does not list removed sections
- [ ] Only ONE intros queue is rendered on the page

## Canonical Queue
- [ ] Default view is "Next 24h"
- [ ] Switching to "Next 7d" shows 7-day range (same list, not a second list)
- [ ] Switching to "Custom" shows date pickers, list updates accordingly
- [ ] Risk-first sorting: NO_Q items appear above Q_SENT above all-clear
- [ ] Summary strip shows correct count, Q completion %, and suggested focus

## Actions – Single Item
- [ ] "Send Q" creates/updates questionnaire, refreshes list
- [ ] "Confirm" creates script_action, refreshes list
- [ ] Re-running "Send Q" on same booking is idempotent (no duplicate)
- [ ] Re-running "Confirm" on same booking is idempotent (no duplicate)

## Actions – Bulk
- [ ] "Send N Qs" shows confirmation modal with list of names
- [ ] "Confirm N" shows confirmation modal with list of names
- [ ] "Assign N" shows owner select, then confirmation modal with names + owner
- [ ] After confirm, toast shows success/fail counts
- [ ] All bulk actions refresh the list after completion
- [ ] Bulk on empty selection: button is hidden (not just disabled)

## Offline Mode
- [ ] Toggle network off → "Offline" badge appears
- [ ] Single actions (Send Q, Confirm) show "offline" toast and do NOT execute
- [ ] Bulk actions show "offline" toast and do NOT execute
- [ ] Toggle network on → badge disappears, manual refresh works

## Filtering Correctness
- [ ] "Next 24h" only shows bookings within 24h window
- [ ] "Next 7d" shows bookings within 7-day window
- [ ] "Custom" respects start/end date pickers
- [ ] "View only at-risk" filters to riskScore > 0
- [ ] "Show all" restores full list

## Performance
- [ ] Query cap at 200 rows, UI shows warning if capped
- [ ] No visible lag on page load with <50 bookings

## Data Integrity
- [ ] My Day actions never write to: result, result_canon, buy_date, commission_amount
- [ ] Outcome changes still flow through Pipeline canonical path only
- [ ] Event logs appear in outcome_events for: questionnaire_sent, intro_confirmed, owner_assigned, bulk_action_completed
