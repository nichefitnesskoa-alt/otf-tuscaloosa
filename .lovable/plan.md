# Plan: Add Lead from WIG + Require Email/Phone + Rename Mindbody → OrangeBook

## 1. "Add Lead" button in WIG SA Leaderboard

In `src/components/wig/WigSaLeaderboard.tsx`, place a new **+ Add Lead** button next to the existing **Sourced Leads** button in the SA Leaderboard `CardHeader` (line ~370). Clicking it opens `AddLeadDialog`. On success, invalidate the sourced-leads query so the new lead appears immediately in the leaderboard count and the Sourced Leads dialog.

## 2. Require email AND phone on self-sourced leads

In `src/components/leads/AddLeadDialog.tsx`:
- Change the Email label to **Email \*** and add it to the required validation alongside first name, last name, phone.
- Update toast: "First name, last name, phone, and email are required."
- Add a short helper line under the form: *"Email and phone are both required so this lead can be imported into OrangeBook."*

Out of scope: Mindbody webhook / IG / sheet imports still allow missing emails — the requirement is only for the manual "Add Lead" path triggered from WIG. (Confirm if you also want the rule enforced on Pipeline → New Leads' add path.)

## 3. Make "OrangeBook" the system of record copy

Replace user-visible "Mindbody" with "OrangeBook" on the SA-facing surfaces tied to this flow. Internal column names (`mindbody_imported_at`, `mindbody_imported_by`) stay as-is — copy-only change.

Files and strings to update:

**`src/components/wig/WigSaLeaderboard.tsx`** — under the SA Leaderboard description add a clear callout banner:
> **All leads go in OrangeBook, not Mindbody.** Add every self-sourced lead here, then check it off once it's in OrangeBook.

**`src/components/wig/SourcedLeadsDialog.tsx`**:
- Status pills: `Needs import` / `In OrangeBook` / `All` (already says "Needs import"; rename "In Mindbody" → "In OrangeBook").
- Subheader counts: `need${s} OrangeBook import` / `already in OrangeBook`.
- Row checkbox tooltip + pill: "Mark imported to OrangeBook" / "Already in OrangeBook (booked)" / "Already in OrangeBook (VIP registrant)" / pill text "In OrangeBook" / "VIP · In OrangeBook".
- "Imported {date} by {sa}" copy unchanged.

**`src/components/admin/MindbodyImportsPanel.tsx`** — user-visible strings only:
- Tab title + header: "OrangeBook Imports".
- Subtitle: "Everyone an SA checked off as imported to OrangeBook…".
- Copy-list header: "Imported to OrangeBook — …".
- CSV filename: `orangebook-imports-…csv`.
- Component filename + Admin tab label can stay (`MindbodyImportsPanel`) — internal only.

**`src/pages/Admin.tsx`** — rename the tab trigger label "Mindbody Imports" → "OrangeBook Imports" (icon unchanged).

## Verification (COHERENCE PROOF at end of build)

- Click **+ Add Lead** from WIG, submit with missing email → blocked with new toast.
- Submit with email → row appears in DB `leads` (`SELECT id, email, source FROM leads ORDER BY created_at DESC LIMIT 1`), SA leaderboard count increments, Sourced Leads dialog shows it.
- Confirm every visible "Mindbody" string on WIG SA Leaderboard, Sourced Leads dialog, and Admin → OrangeBook Imports tab now reads "OrangeBook".
- Confirm the new requirement banner is visible in WIG SA Leaderboard for SA + Admin roles.

## Files touched

- `src/components/wig/WigSaLeaderboard.tsx` (button + banner + copy)
- `src/components/leads/AddLeadDialog.tsx` (require email, helper line)
- `src/components/wig/SourcedLeadsDialog.tsx` (Mindbody → OrangeBook copy)
- `src/components/admin/MindbodyImportsPanel.tsx` (Mindbody → OrangeBook copy, CSV name)
- `src/pages/Admin.tsx` (tab label)

## Open question

Should the email-required rule also apply to **Pipeline → New Leads → Add Lead** (same dialog component, different entry point), or only when added from WIG? Easiest is to enforce universally since both call `AddLeadDialog` — confirm if that's okay.
