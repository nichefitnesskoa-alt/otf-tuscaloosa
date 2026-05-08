## Coaching Scripts — Batch Upload, Smart Naming, Auto-Purge, Jackson Access

### 1. Batch file upload

Replace the single-file `UploadForm` in `src/components/coach/CoachingScripts.tsx` with a multi-file uploader.

- File input: `multiple` enabled, accepts `.docx,.pdf`
- No format/date pickers — every file is parsed from its filename
- Show a per-file preview row before submitting: filename → parsed `{format, date, title}` with a red error if it can't be parsed (skipped on upload)
- Single "Upload all" button uploads each in parallel, refreshes list, closes dialog
- Toast: "Uploaded N scripts" (and "Skipped M unparseable" if any)

### 2. Filename parser

New helper `parseScriptFilename(name)` → `{ format: '2G'|'3G', date: Date, title: string } | null`

Rules (case-insensitive, ignores extension):
- **Format**: match `2G` or `3G` anywhere in the name
- **Date**: match `MonthName + DayNumber` (e.g. `May09`, `May 9`, `may-9`) using current year
  - Also tolerate numeric `M.D.YY`, `M-D-YY`, `M_D` as fallbacks
- Card title (clean): `"2G — May 9"` (format + short date, no year, no upload date)

Example: `May09_2G.docx` → format `2G`, date `2026-05-09`, title `2G — May 9`

### 3. Auto-delete yesterday's scripts (Central Time)

Hard delete: storage file + DB row, at midnight America/Chicago.

- New edge function `cleanup-coaching-scripts` (`verify_jwt = false`)
  - Computes "today" in `America/Chicago`
  - Selects all `coaching_scripts` where `script_date < today_central`
  - For each: deletes storage object from `coaching-scripts` bucket, then deletes DB row
- Schedule via `pg_cron` + `pg_net`: run hourly (cheap insurance against missed minutes / DST), function is idempotent
  - Cron: `0 * * * *` calls the edge function
- Insert via `supabase--insert` tool (URL + anon key are project-specific)

### 4. Coach Jackson access

Verified in DB: Jackson is already `role = 'Coach'`, `is_active = true`.

`src/pages/CoachView.tsx:265` already gates Coaching Scripts with `(isAdmin || user?.role === 'Coach')`, so Jackson sees it the next time he logs in. **No code change needed for access** — confirming this in the plan so it isn't missed.

If Koa wants, we can also surface Coaching Scripts inside `CoachMyIntros` page, but current placement on `/coach-view` already covers him. (Confirm if you want it on a second page.)

### Files touched

- `src/components/coach/CoachingScripts.tsx` — replace `UploadForm` with `BatchUploadForm`, add `parseScriptFilename`, drop format/date selects, simplify card title
- `supabase/functions/cleanup-coaching-scripts/index.ts` — new edge function
- DB (via `insert` tool): pg_cron schedule + enable `pg_cron`/`pg_net` if not already on

### Out of scope

- 1G / S50/T50 uploads (you said only 2G/3G — those formats stay supported for any legacy rows, just not in batch parser)
- Manual override UI for unparseable files (they'll just be skipped with a toast; rename and re-drop)
