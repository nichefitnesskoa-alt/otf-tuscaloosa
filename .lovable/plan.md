### Red / Yellow / Green on Coach Stats columns

**Goal:** Color-code the **Scored** and **Avg score** columns on the WIG Coach tab so coaches instantly see if they’re hitting their lead measures.

**Scored column (percent of intros self-scored):**
- 100% → green
- 75% – 99% → yellow  
- < 75% → red

**Avg score column (self-eval average):**
- 21+ → green
- 11 – 20 → yellow
- < 11 → red

**Implementation:**
- In `src/pages/Wig.tsx`, add two small threshold helpers (`scoredStatusColor`, `avgScoreStatusColor`) that return `WigStatus` tokens.
- In the `sortedCoachRows.map(...)` render block, wrap the **Scored** cell text and **Avg score** cell text with the same `statusClasses(...).text` pattern already used for Close %.
- Also color the **Total** row’s Scored and Avg score values with the weighted/total thresholds.

**Files changed:**
- `src/pages/Wig.tsx`

**No DB or backend changes.**