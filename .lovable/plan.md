

# Plan: Fix Import Button, Add Backfill, and Data Health Auto-Fix

## Three Workstreams

---

## FIX 1 — Import Now Button + Backfill

### Root Cause Analysis
The edge function logs show TWO errors firing every minute from the cron job:
1. **`403 PERMISSION_DENIED`** from Google Sheets API — the service account email does not have access to the spreadsheet. **You must share the Google Sheet with the service account email.** I can extract the email from the function logs or you can find it in the service account JSON.
2. **`supabase2.from(...).insert(...).catch is not a function`** — Supabase JS v2 query builders are thenables but don't have `.catch()`. Line 500 in the catch block uses `.catch(() => {})` which crashes.

The client-side `FunctionsFetchError: Failed to fetch` is a consequence — the function crashes before returning a response, so the browser gets no response.

### Changes

**`supabase/functions/import-sheet-leads/index.ts`**:
- Fix line 500: Replace `.catch(() => {})` with proper try/catch wrapping
- Add `mode` parameter support: when `mode === 'backfill'`, read ALL rows from row 1 (same behavior but explicit), return `rows_scanned` count in addition to existing counters
- Add CORS headers to error responses consistently

**`src/components/admin/LeadSheetImport.tsx`**:
- Add "Audit & Backfill Missing Leads" button below "Import Now"
- Calls `import-sheet-leads` with `{ spreadsheetId, mode: 'backfill' }`
- Shows results: rows scanned, imported, duplicates skipped, errors
- Separate loading state for backfill vs import

### User Action Required
You need to share the Google Sheet with the service account email. I'll add a note in the UI showing which email to share with, or you can check the `GOOGLE_SERVICE_ACCOUNT_JSON` secret for the `client_email` field.

---

## FIX 2 — Data Health Auto-Fix for All Failing Checks

### `src/lib/audit/dataAuditEngine.ts`

Add/update `fixAction` keys for each check and implement the corresponding fix logic in `runAutomatedFix`:

**2A — Outcome Status Sync** (`fix_outcome_status_sync`):
- For each run with `result_canon != 'UNRESOLVED'` linked to an ACTIVE booking:
  - Map `result_canon` → `BookingStatus` using `mapResultToBookingStatus()`
  - Map `BookingStatus` → display string using `formatBookingStatusForDb()`
  - Update `intros_booked` with correct `booking_status` and `booking_status_canon`
- Add `fixAction: 'fix_outcome_status_sync'` to the `checkOutcomeMismatch` check (currently missing)

**2B — 2nd Intro Phone Missing** (`fix_2nd_intro_phones`):
- Already implemented. No changes needed — the fix action and logic exist at line 501-532.

**2C — Booked By Missing** (`fix_booked_by_missing`):
- New fix action: copy `intro_owner` → `booked_by` where `booked_by` is null/empty and `intro_owner` exists
- Add `fixAction: 'fix_booked_by_missing'` to the `checkBookingsWithoutBookedBy` check
- Return affected IDs for records where BOTH `booked_by` and `intro_owner` are null — these need inline editing

**2D — Phone Number Missing** (`fix_phone_from_leads`):
- New fix action: for each booking missing phone, check `leads` table by email match, copy phone
- After copying, normalize with `formatPhoneDisplay` logic (strip +1, format as 10-digit)
- Add `fixAction: 'fix_phone_from_leads'` to the `checkBookingsMissingPhone` check
- Return affected IDs for records where no phone exists anywhere — these need inline editing

**Phone normalization**: After any phone fix, strip leading `+1` or `1` before storing. Use the same logic as `stripCountryCode` from `src/lib/parsing/phone.ts`.

---

## FIX 3 — Data Health Panel UX

### `src/components/admin/DataAuditDashboard.tsx`

**"Fix All Issues" button** at top of Data Health panel:
- Appears when any check has a `fixAction`
- Runs all available auto-fixes in sequence
- Shows spinner during execution, then result summary
- Re-runs full audit after completion

**CheckRow detail view enhancements**:
- When expanded and `fixAction` exists: show orange "Fix All" button at top of detail section
- Fix All runs immediately, shows spinner, then "Fixed X records", re-runs the specific check
- Badge updates immediately after fix

**Inline editable fields for manual-fix records**:
- For Booked By Missing: records where both `booked_by` and `intro_owner` are null show an inline text input
- For Phone Number Missing: records where no phone exists anywhere show an inline text input
- Tap to edit, save on blur, update the record directly via Supabase
- After save, re-run the check to update badge

### Implementation Detail
- Add a new `needsManualInput` flag to `AuditCheckResult` to distinguish records that can be auto-fixed vs need manual entry
- Add `manualFixIds` array to track which specific records need inline editing
- Create an `InlineFixField` sub-component for the editable fields within the detail view

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/import-sheet-leads/index.ts` | Fix `.catch()` bug, add backfill mode |
| `src/components/admin/LeadSheetImport.tsx` | Add Backfill button + results display |
| `src/lib/audit/dataAuditEngine.ts` | Add fixActions for 2A/2C/2D, implement fix logic |
| `src/components/admin/DataAuditDashboard.tsx` | Add Fix All Issues button, inline editable fields, improved detail view |

No other files are touched.

