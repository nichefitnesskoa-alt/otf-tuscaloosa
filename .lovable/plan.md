

# Plan: Inbound Lead Import from Google Sheet

## Overview
Create a new edge function `import-sheet-leads` that reads the "OTF Lead Intake" tab, deduplicates against existing `intros_booked` and `leads` tables, and inserts new records. Include both a manual trigger button in Admin and a cron job running every 5 minutes.

## 1. New Edge Function — `supabase/functions/import-sheet-leads/index.ts`

- **Auth**: Use service role key (no JWT needed since it will run on cron). For manual triggers, verify staff auth.
- **Flow**:
  1. Get Google access token using existing `GOOGLE_SERVICE_ACCOUNT_JSON` (same pattern as `sync-sheets`)
  2. Read all rows from `OTF Lead Intake` tab
  3. Parse headers dynamically (map column names like `First Name`, `Last Name`, `Email`, `Phone`, `Date`, `Time`, etc.)
  4. For each row:
     - Skip empty/header rows
     - If row has a booking date + time → treat as **intro booking** → check `intros_booked` by name+date+time, then by phone → insert into `intros_booked` if new
     - If row has no date/time → treat as **web lead** → check `leads` by email/phone, then `intros_booked` by name → insert into `leads` if new, with appropriate dedup stage (`already_in_system`, `flagged`, `new`)
  5. Track results: `{imported: N, skipped_duplicate: N, errors: N}`
  6. Log to `sheets_sync_log` table

- **Dedup logic** (reuses `import-lead` patterns):
  - Check `intros_booked` by name (case-insensitive) + date
  - Check `intros_booked` by phone/phone_e164
  - Check `leads` by email or phone
  - If already exists anywhere → skip, log as duplicate
  - If name-only match → insert with `duplicate_confidence: 'MEDIUM'`, stage `flagged`

## 2. Config — `supabase/config.toml`

Add:
```toml
[functions.import-sheet-leads]
verify_jwt = false
```

## 3. Cron Job — SQL via insert tool

Schedule `import-sheet-leads` to run every 5 minutes using `pg_cron` + `pg_net`. Enable extensions if needed. The cron will POST to the function URL with the spreadsheet ID stored as a secret or passed in the body.

## 4. Admin UI — Manual Trigger

Add a button in the Settings or Admin page (alongside existing Data Sync controls) that calls `import-sheet-leads` manually. Shows results (imported/skipped/errors) in a toast or inline summary.

**File**: New component `src/components/admin/LeadSheetImport.tsx`
- "Import Leads from Sheet" button
- Calls `supabase.functions.invoke('import-sheet-leads', { body: { spreadsheetId } })`
- Shows result counts

**File**: `src/pages/Settings.tsx` — Add `<LeadSheetImport />` component

## 5. Spreadsheet ID

The function will use the same spreadsheet ID from `localStorage` (via `getSpreadsheetId()`) for manual triggers. For the cron job, we'll store it as a Supabase secret `LEADS_SPREADSHEET_ID`.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/import-sheet-leads/index.ts` | New edge function |
| `supabase/config.toml` | Add function config (auto-managed) |
| `src/components/admin/LeadSheetImport.tsx` | New manual trigger UI |
| `src/pages/Settings.tsx` | Add LeadSheetImport component |
| DB (pg_cron) | Schedule every-5-min cron job |

