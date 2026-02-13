

# Promote Client Pipeline to Full Edit Mode and Remove Admin Redundancy

## Summary
Replace the read-only `ClientJourneyReadOnly` component on the Pipeline page with the full-featured `ClientJourneyPanel` (currently Admin-only), giving all staff editing capabilities. Then remove `ClientJourneyPanel` from the Admin Data tab to eliminate redundancy.

## Changes

### 1. Pipeline page (`src/pages/Pipeline.tsx`)
- Replace `ClientJourneyReadOnly` import with `ClientJourneyPanel` from `src/components/admin/ClientJourneyPanel.tsx`
- Replace `MembershipPurchasesReadOnly` with `MembershipPurchasesPanel` from `src/components/admin/MembershipPurchasesPanel.tsx`
- Keep `PastBookingQuestionnaires` as-is

### 2. Admin page (`src/pages/Admin.tsx`)
- Remove `ClientJourneyPanel` from the Data tab
- Remove the import for `ClientJourneyPanel`
- The Data tab will retain: `VipBulkImport`, `MembershipPurchasesPanel`, and `ShiftRecapsEditor`

### 3. Cleanup (optional)
- `ClientJourneyReadOnly` (951 lines) and `MembershipPurchasesReadOnly` (321 lines) become unused and can be deleted to reduce code bloat

## Technical Notes
- `ClientJourneyPanel` already has all the editing dialogs (edit booking, edit run, mark as purchased, set intro owner, hard delete, link run, create booking/run, bulk VIP scheduling)
- No auth guard needed since the Pipeline page is already behind `ProtectedRoute` and the component doesn't check for admin role internally
- `MembershipPurchasesPanel` in Admin Data tab stays since it has admin-specific editing features beyond what the pipeline needs -- actually, since we're giving everyone edit access, we should remove it from Admin too to avoid redundancy. The Pipeline page will have both `ClientJourneyPanel` and `MembershipPurchasesPanel`.

### Revised Admin Data tab cleanup
- Remove both `ClientJourneyPanel` AND `MembershipPurchasesPanel` from Admin Data tab (both now live on Pipeline)
- Admin Data tab keeps: `VipBulkImport` and `ShiftRecapsEditor`
