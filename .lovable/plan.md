# Fix outreach list layout + broken import

## What's actually wrong (diagnosed from the DB)

The uploaded spreadsheet has a **title sentence in row 1** ("Cross-referenced against Active Member Detail…") and the **real column headers in row 2** ("Client", "Email", "Phone #", "Item", "Amount", …).

`XLSX.sheet_to_json` used row 1 as the header row, so:
- Every real column became `__EMPTY`, `__EMPTY_1`, `__EMPTY_2`… and got dumped into `metadata`.
- `client_name` and `item` both got filled with the title sentence — that's the "cross-reference line" you're seeing.
- `amount` is 0/blank for everyone because the actual "$169.00" values are hiding in `metadata.__EMPTY_3`.
- Churn flag is blank because the real "Churning" column landed in `metadata.__EMPTY_10`.

So the fix is two things: **fix the importer** so it finds the real header row, and **redesign the detail page** as a spreadsheet-style table with churn visible at a glance.

## 1. Fix the importer (root cause)

In `OutreachListImport.tsx`:

- After `XLSX.utils.sheet_to_json`, detect the real header row by scanning the first ~10 rows using `sheet_to_json(ws, { header: 1 })` (array-of-arrays mode) and picking the first row where any cell matches `/^(client|name|member|full name)/i`.
- Re-parse the sheet using that row as `range` (skip rows above it).
- Add a small "Header row" number input in the sheet card so the user can override the auto-detected row (1-indexed) if we guess wrong.
- Also strip `__EMPTY*` keys from `metadata` so junk never leaks in.

## 2. Clean up the two bad lists

They're unrecoverable in place (real values are in `metadata.__EMPTY_*` with no schema guarantees). Simplest safe path: delete the two existing rows for lists `Elite & Basic` and `Premier $139+` (and their `outreach_list_rows`), then re-import the same file with the fixed wizard. I'll do the delete via migration and you re-upload.

## 3. Redesign detail page as a spreadsheet-style table

Replace the stacked cards in `OutreachListDetail.tsx` with a single dense horizontal table. One row per person, churning members flagged inline (not in a separate section) so you see everyone at once and can still tell churns at a glance.

Columns (left → right):
```text
[⚠]  Name           Item                          Amount   Phone           Last 30d   Latest         Texted   In Person   Actions
 🔴  Riemer, Natasha FMF26 Premier Membership     $169.00  (714) 319-5128  1          Jun 12          [ ]      [ ]         Save · Upgrade · Refer
     Thomas, Emily   Orange Premier Membership    $169.00  (636) 696-9586  19         Jun 30          [ ]      [ ]         Save · Upgrade · Refer
```

- Churning rows: red left border + red ⚠ + tiny "Churns Jul 20" under the name. Sorted to top by `churn_date` ascending, then everyone else alphabetical.
- Sticky header row, zebra striping, compact 32–36px row height so ~15+ people fit on screen.
- Texted / In Person become small checkbox-style pills in their own columns (still live-attributed on hover tooltip).
- Actions column: three tiny icon buttons (Save call only for churning, Log Upgrade, Log Referral).
- Remove the two-section split ("Retention" vs "Standard") — replaced by inline churn styling + sort order.
- Remove the list description/subtitle area entirely (that's where the "cross-reference" sentence was showing up as the list name — after re-import the list name will be clean, but I'll also make sure no long description text is rendered under the H1).
- Mobile: collapses to a compact card list (name + churn flag + amount + one action row) since a real table won't fit on phones.

## Files touched

- `src/pages/OutreachListImport.tsx` — header-row detection + override + metadata cleanup
- `src/pages/OutreachListDetail.tsx` — table layout, inline churn flagging, remove sections
- New migration — delete the two mis-imported lists and their rows

## Not touching

SOML tables, scoreboard, WIG logic, roles, or the `outreach_*` schema itself.
