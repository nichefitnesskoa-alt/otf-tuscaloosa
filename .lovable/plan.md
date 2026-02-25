

# Delete Purchases from Pay Period Commission + Fix Cold Lead/DM Counts in Win the Day

## Problem 1: No way to delete purchases from Pay Period Commission

The `PayPeriodCommission` component shows sale details per intro owner but has no delete action. The `SaleDetail` interface doesn't even track the record `id` or source table, making deletion impossible without changes.

### Changes to `src/components/PayPeriodCommission.tsx`

1. **Add `id` and source info to `SaleDetail` interface** — add `id: string` and `sourceTable: 'intros_run' | 'sales_outside_intro'` fields
2. **Populate `id` and `sourceTable`** when building detail rows from runs (lines 209-218) and sales (lines 229-238)
3. **Add a delete handler** that:
   - Shows a confirmation dialog (using `AlertDialog`)
   - On confirm, sets `commission_amount = 0` on the record (soft-delete approach — preserves the run/sale record but zeroes out commission) OR fully deletes the record
   - Refreshes payroll data after deletion
4. **Add a Trash icon button** on each detail row (next to the commission amount, lines 441-443) — only visible to admins or always visible depending on preference
5. **Add confirmation toast** after successful deletion

### Approach: Zero out commission vs hard delete
I'll use a "remove from commission" approach — set `commission_amount = 0` on the source record. This preserves the intro run/sale data for reporting while removing it from payroll. A hard delete option can also be offered via a secondary action.

---

## Problem 2: Cold Lead Texts and DMs not showing in Win the Day

The `useWinTheDayItems.ts` hook currently generates items for questionnaires, confirmations, prep, follow-ups, leads, IG logs, and shift recaps — but **never queries `daily_outreach_log`** and never creates `cold_texts` or `cold_dms` checklist items. The types aren't even in the `ChecklistItemType` union.

### Changes to `src/features/myDay/useWinTheDayItems.ts`

1. **Add `cold_texts` and `cold_dms` to `ChecklistItemType` union** (line 12-20)
2. **Query `daily_outreach_log`** for today's date to get totals across all SAs:
   ```ts
   const { data: outreachLogs } = await supabase
     .from('daily_outreach_log')
     .select('cold_texts_sent, cold_dms_sent')
     .eq('log_date', todayStr);
   const totalTexts = (outreachLogs || []).reduce((sum, l) => sum + l.cold_texts_sent, 0);
   const totalDms = (outreachLogs || []).reduce((sum, l) => sum + l.cold_dms_sent, 0);
   ```
3. **Create two new checklist items** after the existing items:
   - `cold_texts`: "Send 30 cold lead texts (X/30 done today)" — completed when totalTexts >= 30
   - `cold_dms`: "Send 50 DMs (X/50 done today)" — completed when totalDms >= 50
4. **Add `daily_outreach_log` to the realtime subscription** (line 347-358) so counts update live

### Changes to `src/features/myDay/WinTheDay.tsx`

1. **Add `cold_texts` and `cold_dms` to `INFLUENCED_TYPES`** array (line 31) so tapping the circle opens a reflection drawer
2. **Add state for outreach input** — `coldTextsCount` and `coldDmsCount` number state
3. **Add two new reflection drawers** for cold_texts and cold_dms:
   - Each has a number input "How many did you send this shift?"
   - On submit, upserts into `daily_outreach_log` for the current SA + today
   - Shows remaining count after submission
4. **Add handler `handleOutreachReflection`** that upserts to `daily_outreach_log` and refreshes

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/PayPeriodCommission.tsx` | Add `id`/`sourceTable` to SaleDetail, add delete button per row with confirmation, zero-out or delete commission record |
| `src/features/myDay/useWinTheDayItems.ts` | Add `cold_texts`/`cold_dms` types, query `daily_outreach_log`, generate checklist items, add realtime subscription |
| `src/features/myDay/WinTheDay.tsx` | Add outreach reflection drawers for cold texts and DMs with number input and upsert logic |

