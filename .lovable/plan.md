

## Change Per-SA Performance to Total Journey

The Per-SA table currently shows `Run` (1st intros showed) as the denominator for close rate. You want it to match the "Total Journey" definition: **1st intros booked → any sale**.

### Changes

**1. `PerSATable.tsx` — rename column and update interface**
- Rename `introsRun` to `introsBooked` in the `PerSAMetrics` interface
- Change column header from "Run" to "Booked"
- Update sort key references

**2. `useDashboardMetrics.ts` — change Per-SA computation**
- Count 1st intro **bookings** per SA (using `intro_owner` on the booking record) instead of 1st intro runs
- Keep sales logic unchanged (already includes 1st + 2nd intro sales)
- Close rate becomes `salesCount / introsBookedCount * 100`
- Update the return object to use `introsBooked` instead of `introsRun`

**3. Studio aggregates (same file)**
- Update `studioIntrosRun` aggregation to sum from `introsBooked` instead of `introsRun`
- Update leaderboard filter that checks `m.introsRun >= MIN_INTROS_FOR_CLOSING`

**4. Header subtitle**
- Update the PerSATable subtitle from "credited to intro_owner (first intro runner)" to "Total Journey · 1st booked → any sale"

**5. Downstream consumers**
- `WigSection.tsx` references a separate `PerSAMetric` type (different from `PerSAMetrics`) — no change needed there
- `Recaps.tsx` just renders `<PerSATable>` — no change needed

