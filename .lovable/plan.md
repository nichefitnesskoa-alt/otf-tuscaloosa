REACH MAP for Net Gain churn upload/date correction
- Tables touched: `net_gain_churns`, `net_gain_log`, `net_gain_state`
- Hooks/queries that read these tables:
  - `src/components/shared/NetGainScoreboard.tsx` reads `net_gain_state`, pending `net_gain_churns`, `net_gain_log`
  - Same component calls `apply_pending_net_gain_churns()` on mount
- Writers:
  - Upload dialog inserts `net_gain_churns`
  - Manual +/-/exact value uses `net_gain_write_delta()`
  - Manage Churns currently deletes `net_gain_churns`, which reverses applied churns through backend function
  - `apply_pending_net_gain_churns()` applies churn rows after their churn date has passed
- Components that display this data:
  - My Day: `NetGainScoreboard`
  - Studio: `NetGainScoreboard`
  - WIG: `NetGainScoreboard`
  - Upload preview and Manage Churns dialogs
  - History dialog
- Metrics/helpers derived from this data:
  - Current Net Gain = `net_gain_state.value`
  - Remaining churn target = pending churn count through end of month minus current net gain
  - Apply eligibility = `churn_date < today in America/Chicago`, so a July 3 churn applies on July 4
- React Query cache keys: none, this component uses direct backend reads plus the `otf:netGainChanged` browser event
- Cross-page surfaces affected: My Day, Studio, WIG
- Backend functions/triggers involved:
  - `apply_pending_net_gain_churns()`
  - `net_gain_write_delta()`
  - `net_gain_churn_reverse_on_delete()`
  - Sale automation functions are separate and should remain unaffected

Current finding
- The upload parser is choosing the first spreadsheet column matching `/date|churn|end/`.
- In your uploaded file, columns are: `Termination request date` first, then `Churn date`.
- That made 17 people apply immediately from old request dates in May/June.
- The actual uploaded file has 18 churns:
  - 1 should already count: Caitlin Geary, actual churn date `2026-07-01`
  - 17 should remain pending as of `2026-07-03`, including July 3 and future dates
  - Sheena Gregg was missed because her request date was blank, even though actual churn date exists

Plan
1. Fix the upload parser at the source
   - Replace the broad “first date-like column” detection with explicit header priority:
     1. `Churn date`
     2. `Actual churn date`
     3. `Termination date`
     4. `Cancellation effective date`
     5. `Contract end date` only as a last fallback
   - Explicitly exclude `Termination request date`, `Request date`, and similar request-only columns from being used as the churn-out date.
   - Keep robust date parsing, but remove the unsafe `new Date(dateString)` fallback for bare spreadsheet strings.
   - Show the selected date column in the upload preview so it is obvious when the app is reading “Churn date”.

2. Make the upload preview match the business rule
   - Update copy to say: “Uses actual churn date, not request date.”
   - Keep application rule: subtracts the day after the churn date, meaning backend condition stays `churn_date < today Central`.
   - Preview will show:
     - actual churn date
     - reason/notes
     - status
     - whether it will apply now or stay scheduled

3. Repair the already-bad July upload safely
   - Correct existing `net_gain_churns` rows from request dates to actual `Churn date` values from the uploaded file.
   - Add the missing Sheena Gregg row as pending for `2026-07-29`.
   - Reverse the 16 incorrect auto-applied future churns with a clear audit log correction.
   - Preserve the one legitimate applied churn, Caitlin Geary, so Net Gain becomes `-1`.
   - Reset future churn rows to pending so they can auto-subtract later on the day after their actual churn date.
   - Preserve audit history by marking the old bad churn log rows as correction/error rows instead of silently erasing what happened.

4. Improve the scoreboard target line
   - Show current Net Gain prominently as it does now.
   - Add a clearer line like:
     - “17 scheduled terminations left this month.”
     - “Need +18 membership sales by Jul 31 to finish positive.”
   - Formula after correction: pending churns this month minus current net gain, so at `-1` with 17 remaining, goal to finish positive is `18`.

5. Verify cross-page coherence before reporting done
   - Database checks:
     - `net_gain_state.value = -1`
     - `net_gain_churns`: 1 applied, 17 pending for July upload
     - `net_gain_log` sums back to the state value
   - UI checks:
     - My Day shows `-1`
     - Studio shows `-1`
     - WIG shows `-1`
     - Manage Churns shows 17 pending and 1 applied
     - Upload preview for the same spreadsheet reads `Churn date`, not `Termination request date`
   - Confirm sale automation and manual Net Gain controls still work without changing WIG/SOML or other scoreboards.