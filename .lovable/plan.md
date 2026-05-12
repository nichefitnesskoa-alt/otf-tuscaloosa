## MyDay Leads — Tab Cleanup + Speed to Lead Fix

### 1. Reduce sub-tabs from 5 → 2
File: `src/features/myDay/MyDayNewLeadsTab.tsx`

Remove the `New`, `Flagged`, and `In System` tabs entirely. Final tab list:
- **Contacted** — every lead that has been reached at least once, **including** leads now in `booked`/`won`. Filter: `stage IN ('contacted','booked','won')`.
- **Booked** — only `stage IN ('booked','won')` (unchanged behavior, just becomes the second tab).

Default `subTab` becomes `'contacted'`.

Drop the related JSX: `<TabsTrigger value="new|flagged|system">`, the matching `<TabsContent>` blocks, and the unused derived arrays (`newLeads`, `flaggedLeads`, `alreadyInSystem`). Keep `newLeads` derivation only where still needed (Speed-to-Lead banner and `onCountChange` so the parent badge still reflects fresh-new count).

LeadCard branches for `isNew` / `isFlagged` stay (they may still appear inside Contacted view if a lead's stage is technically still `new` — but since we no longer surface them here, those branches are simply unreachable from this tab). No changes to LeadCard logic, just no entry point.

### 2. Keep overdue New leads visible at-a-glance
File: `src/features/myDay/NewLeadsAlert.tsx` — already renders all `stage='new'` leads from the last 48h that haven't been contacted/booked. No change needed; this becomes the only surface for New leads, exactly as requested ("stay in the at a glance section till they end up going in contacted or booked").

The Speed-to-Lead banner inside `MyDayNewLeadsTab` is removed from the top of the tab block (it's redundant now that New leads aren't a tab) and **moved up into / next to** the NewLeadsAlert area, OR kept inline above the Contacted/Booked tabs. Recommended: keep it above the tabs since it still summarizes overdue/avg response across all leads loaded here. CONFIRM THIS VALUE — keep banner above tabs vs. remove it entirely.

### 3. Fix "Speed to Lead isn't working"
File: `src/features/myDay/MyDayNewLeadsTab.tsx` (`SpeedToLeadBanner` + per-card `responseMinutes`).

Root cause: the banner queries `lead_activities` filtering `activity_type = 'contacted'`, but `handleAction('contacted')` writes `activity_type: 'stage_change'` with `notes: 'Marked as Contacted from MyDay'`. No rows ever match → always "No contacts yet" / `Avg: —`.

Fix:
- Replace the filter with: `activity_type IN ('contacted','stage_change','script_sent')` and on the client take the earliest row per `lead_id` whose `activity_type='contacted'` OR (`activity_type='stage_change'` AND `notes ILIKE '%contacted%'`) OR `activity_type='script_sent'`.
- Also union with `script_send_log` (earliest `created_at` per `lead_id`) so a script send counts as first touch even if no stage flip happened.
- Use `Math.min(stageChangeFirst, scriptSendFirst)` per lead vs. `lead.created_at` for response minutes.
- Apply the same union in the per-card `responseMinutes` computation (currently `parseISO(lead.updated_at) - parseISO(lead.created_at)` which is unreliable).

### 4. Coherence checks before done
- Parent `onCountChange` still receives count of `stage='new'` leads → tab badge / FAB count unchanged.
- `NewLeadsAlert` continues to show overdue news; verify a brand-new lead appears there and disappears once moved to Contacted (already handled by its realtime channel + 60s refetch).
- Verify Contacted tab now lists booked leads too (a booked lead should appear in BOTH Contacted and Booked).
- Verify Speed to Lead shows real Avg/Best after marking a lead Contacted, and per-card "Responded in Xm" appears.
- Confirm no broken imports (`AlertTriangle` may become unused — clean up).

### Files touched
- `src/features/myDay/MyDayNewLeadsTab.tsx` (tab removal + speed-to-lead query fix)

### Open question
Keep the Speed-to-Lead banner visible above the Contacted/Booked tabs, or remove it now that New isn't a tab here? (Default plan: keep it.)
