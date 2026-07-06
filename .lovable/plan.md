## Diagnosis (confirmed against the codebase)

- **Member Referral path:** `intros_booked.lead_source = 'Member Referral'` + `referred_by_member_name` (required by trigger `enforce_member_referral_has_referrer`). On insert, `soml_create_pending_referral` writes to `soml_pending_referrals`; on a later sale in `intros_run`, `soml_resolve_pending_referral` flips state to `realized`. A buddy submission has to land in this same path.
- **Public insert RLS:** `leads` already has a public INSERT policy — `/buddy` can insert with the anon key, no auth.
- **Phantom-suppression list:** `src/lib/sa/leadsBooked.ts` → `PHANTOM_BOOKED_BY` (`Self booked`, `System (Sheet Import)`, `AM Shift`…). Consumed by `getLeadBookedCreditSa`, `useSaLeads`, `salesBooked`, `sourcedLeadsToText`, `WigSaLeaderboard`. Adding `'Buddy Card'` here excludes it from every leaderboard via one shared mechanism.
- **Self-Sourced Leads dialog:** `src/components/wig/SourcedLeadsDialog.tsx` groups `leads` by `sourced_by_sa`; a buddy submission with `sourced_by_sa = 'Buddy Card'` shows up as its own row automatically.
- **Claim flow to reuse:** No generic "claim" button — the working pattern is MyDay → `NewLeadsAlert` shows `stage='new'` leads → SA taps → `BookIntroDialog` → `intros_booked.booked_by = <SA>`. Booking IS the claim.
- **Gap:** `leads` has no `referred_by_member_name` column, and `soml_pending_referrals` has no way to know the referring member is owed a $50-off credit on sale.

---

## Build plan

### 1. One migration (schema + trigger)

- `leads`: add `referred_by_member_name text` (**the referring member's full name — required on every buddy submission**), `referring_member_contact text` (their phone or email), `is_buddy_card boolean not null default false`.
- `intros_booked`: add `is_buddy_card_referral boolean not null default false`.
- `soml_pending_referrals`: add `discount_owed_to text`, `discount_owed_contact text`, `discount_owed_amount_cents int`, `discount_honored_at timestamptz`, `discount_honored_by text`.
- Extend `soml_create_pending_referral` trigger so when `NEW.is_buddy_card_referral = true`, it also writes `discount_owed_to`, `discount_owed_contact`, `discount_owed_amount_cents = 5000` on the pending row. Existing GRANTs cover new columns.

### 2. `PHANTOM_BOOKED_BY` update (single line)

Add `'Buddy Card'` to the set in `src/lib/sa/leadsBooked.ts`. Every leaderboard / attribution surface now excludes it automatically.

### 3. Public `/buddy` page

New `src/pages/BuddyCard.tsx`, registered outside the authed shell in `App.tsx` (like `/book-intro`, `/q/:slug`). OTF brand dark (`#0A0A0A` bg, bone text, orange accent, PP Right Grotesk), mobile-first.

Copy: "Bring a buddy. Give us a friend who'd love this and we'll reach out. You get $50 off your next month when they sign up."

**Fields (all required, validated with zod, trim + length caps):**

1. **Your full name** (the referring member) — required, ≤100 chars → written to `leads.referred_by_member_name`.
2. **Your phone or email** — required, must parse as a valid US phone (via `stripCountryCode`) or email → written to `leads.referring_member_contact`.
3. Friend's name — required, ≤100 chars → `leads.first_name` / `last_name`.
4. Friend's phone — required, valid US 10-digit → `leads.phone`.
5. Friend's email — required, valid email ≤255 chars → `leads.email`.

No class-time picker. Reminder line above submit. Confirmation screen: "Got it. We'll reach out to {friend}. When they sign up for a membership, you get $50 off your next month."

Submit inserts one `leads` row:

```
first_name, last_name       = friend
phone, email                = friend contact
source                      = 'Member Referral'
stage                       = 'new'
sourced_by_sa               = 'Buddy Card'          // placeholder
is_buddy_card               = true
referred_by_member_name     = <submitter full name> // REQUIRED
referring_member_contact    = <submitter contact>
```

Plus a `lead_activities` note ("Buddy Card submitted by {member} ({contact})."). Public URL built from `PUBLIC_BOOKING_BASE` → `https://otf-tuscaloosa.lovable.app/buddy`. A "Copy Buddy Card link" + QR download button is added on the WIG SOML section for flier printing.

### 4. Self-Sourced Leads = home for buddy leads

Because `sourced_by_sa = 'Buddy Card'`, buddy submissions already fall into the "By SA" grouping in `SourcedLeadsDialog` as their own row. Polish only:

- Sort so any "Buddy Card" row pins to the top with an orange "New — needs a home" tag.
- Row expands to show each buddy lead with friend contact **and the referring member's name + contact**; a "Claim & Book" button opens the existing `BookIntroDialog` prefilled with:
  - `lead_source = 'Member Referral'` (locked)
  - `referred_by_member_name` from the lead (locked)
  - `is_buddy_card_referral = true` on the created `intros_booked`
- CSV/text exports read `sourced_by_sa`, so "Buddy Card" naturally lists as its own bucket.

### 5. Notifications in MyDay + WIG

- **DB:** insert a `notifications` row on `/buddy` submit (`notification_type = 'buddy_card_new'`, body includes friend name **and referring member name**) so it's visible cross-device, cross-session.
- **MyDay:** extend `NewLeadsAlert` (or add a sibling banner styled like `VipClaimBanner`) to surface unread `buddy_card_new` rows at the top with an orange "Buddy Card" chip, friend contact, referring-member name, and a "Claim & Book" button that opens `BookIntroDialog` with the prefill above. Dismiss marks `read_at`.
- **WIG:** a small orange pill on the Self-Sourced Leads tile ("N Buddy Card leads waiting") that opens `SourcedLeadsDialog` scrolled to the Buddy Card row. Same query — no duplicate counts.

Neither surface credits "Buddy Card" toward any SA — it's a notice, not a leaderboard entry.

### 6. Discount-owed surfacing (SOML)

`useSomlData.realizedReferrals` gains the new `discount_owed_*` fields. In `src/features/wig/soml/SomlSection.tsx`, each realized referral that carries a `discount_owed_to` shows a "$50 off owed to {member} — {contact}" chip with a "Mark honored" button (writes `discount_honored_at / by`, Admin-only). Pending referrals never show the chip (pending ≠ owed). Nothing auto-bills.

---

## Coherence proof (to run at end of build)

1. Submit `/buddy` with test data:
  - `leads` row: `sourced_by_sa='Buddy Card'`, `is_buddy_card=true`, `referred_by_member_name=<submitter name>`, `referring_member_contact=<submitter contact>`, friend fields populated, no class time anywhere.
  - `notifications` row: `notification_type='buddy_card_new'`, unread, body names friend + referring member.
  - No `soml_pending_referrals` row yet (created on booking).
2. MyDay banner shows "Buddy Card — {friend} · referred by {member}" with Claim & Book. WIG Self-Sourced Leads dialog shows a "Buddy Card" row with the lead; tile shows "1 Buddy Card lead waiting."
3. SA taps Claim & Book → `BookIntroDialog` prefilled → save:
  - `intros_booked.booked_by=<SA>`, `lead_source='Member Referral'`, `referred_by_member_name=<submitter>`, `is_buddy_card_referral=true`.
  - `soml_pending_referrals`: credited to the SA, `discount_owed_to=<submitter>`, `discount_owed_amount_cents=5000`, `discount_honored_at IS NULL`.
  - Notification marked read.
4. Log a sale on that intro:
  - `soml_pending_referrals.state='realized'`.
  - WIG SOML: referral count +1 for the SA (WIG, Pipeline, per-SA agree); realized-referrals list shows the "$50 off owed to {submitter}" chip.
5. Leaderboard sweep with the buddy lead unclaimed:
  - WIG SA leaderboard, per-SA table, sourced-leads text, sales attribution: none credit "Buddy Card." Verified via `PHANTOM_BOOKED_BY` inclusion.
  - After claim + sale: full credit lands on the claiming SA on WIG, Pipeline, Commission, Per-SA — same numbers on all pages.
6. Admin taps "Mark honored" → `discount_honored_at / by` set, chip flips to "Honored {date} by {admin}." Grep confirms no Mindbody/billing calls added — tracking only.
7. All agree: **yes** — closing report will name the exact DB rows and cross-page numbers verified.