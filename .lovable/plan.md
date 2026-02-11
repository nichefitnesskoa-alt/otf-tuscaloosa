

# VIP Class Registration Form + Bulk Import

## What You Get

### 1. Public VIP Registration Form
A shareable link (e.g., `otf-tuscaloosa.lovable.app/vip-register`) that VIP class invitees can fill out. It collects:
- First Name, Last Name
- Email, Phone Number
- Birthday (for heart rate monitor setup)
- Weight in LBs (for heart rate monitor setup)

When submitted, it automatically:
- Creates a booking in `intros_booked` with lead source "VIP Class"
- The person immediately appears in your VIP tab in the Client Pipeline
- No staff action needed -- it's fully self-service

The form will have the same OTF-branded look as the existing questionnaire (orange theme, logo, clean mobile-friendly design).

### 2. Bulk Import for Existing VIP Contacts
An admin tool (in the Admin panel) where you can paste a spreadsheet of existing VIP contacts. Each row needs at minimum first name, last name, phone, and email. Birthday and weight are optional. It will:
- Create bookings in `intros_booked` with "VIP Class" lead source for each person
- Store the extra info (birthday, weight) for heart rate monitor setup
- Skip duplicates based on name matching

### 3. Heart Rate Monitor Info Visible in Pipeline
The VIP tab cards will show birthday and weight when available, so you can set up heart rate monitors before clients arrive.

---

## Technical Details

### New Database Table: `vip_registrations`

Stores the extra VIP-specific data (birthday, weight) that doesn't belong in `intros_booked`:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| first_name | text | Required |
| last_name | text | Required |
| email | text | Nullable |
| phone | text | Required |
| birthday | date | Nullable |
| weight_lbs | integer | Nullable |
| booking_id | uuid | Links to intros_booked |
| created_at | timestamptz | Default now() |

RLS: Public INSERT (form submissions), authenticated SELECT/UPDATE/DELETE.

### New Page: `src/pages/VipRegister.tsx`

Public form page at `/vip-register` (no login required). Styled to match the existing questionnaire page (OTF orange branding). On submit:
1. Creates an `intros_booked` entry with member name, lead source "VIP Class", class date as today, coach "TBD", sa "VIP Registration", booked_by "Self (VIP Form)"
2. Creates a `vip_registrations` entry with birthday, weight, and link to the booking
3. Shows a confirmation screen

### Route Addition: `src/App.tsx`

Add `/vip-register` as a public route (like `/q/:id`).

### Admin Bulk Import: `src/components/admin/VipBulkImport.tsx`

A component in the Admin panel with a textarea where you paste tab-separated or comma-separated data. Columns: First Name, Last Name, Phone, Email (optional: Birthday, Weight). Each row creates a booking + vip_registration entry. Shows a preview table before confirming.

### Admin Panel Update: `src/pages/Admin.tsx`

Add the VIP Bulk Import component to the admin page.

### VIP Info Display: `src/components/dashboard/ClientJourneyReadOnly.tsx` + `src/components/admin/ClientJourneyPanel.tsx`

When rendering cards in the VIP tab, fetch matching `vip_registrations` data and display birthday/weight as small badges so you can prep heart rate monitors.

---

## File Summary

| Action | File | What Changes |
|--------|------|-------------|
| Create | DB migration | New `vip_registrations` table |
| Create | `src/pages/VipRegister.tsx` | Public VIP registration form |
| Create | `src/components/admin/VipBulkImport.tsx` | Bulk paste import tool |
| Edit | `src/App.tsx` | Add `/vip-register` route |
| Edit | `src/pages/Admin.tsx` | Add VIP Bulk Import section |
| Edit | `src/components/dashboard/ClientJourneyReadOnly.tsx` | Show birthday/weight on VIP cards |
| Edit | `src/components/admin/ClientJourneyPanel.tsx` | Show birthday/weight on VIP cards |

