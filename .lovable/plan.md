## Plan

Two independent issues. Both small, scoped fixes.

---

### 1. VIP group contact (Nicole Welch) missing from registrant list in My Day

**Root cause:** `VipRegistrationsSheet.tsx` loads only `vip_registrations` where `is_group_contact = false`. The new `contact_attending_class` toggle bumps the header count (6) but never adds the contact as a row, so she can't be marked Showed/No-show and never appears in summaries.

**Fix:**
- In `VipRegistrationsSheet.tsx`, also fetch the session's `reserved_contact_name`, `reserved_contact_phone`, `reserved_contact_email`, `contact_attending_class`, `contact_outcome`, `contact_outcome_logged_at`, `contact_outcome_logged_by`.
- When `contact_attending_class === true` AND `reserved_contact_name` exists, prepend a synthetic row to the rendered list, visually badged "Group Contact" (brand color), with the same Showed / No-show / Booked intro / Purchased dropdown as members.
- Persist the contact's outcome on `vip_sessions` (new columns `contact_outcome`, `contact_outcome_logged_at`, `contact_outcome_logged_by`) — keeps `vip_registrations` clean and avoids creating fake registration rows.
- Include the contact in the summary counters (`totalRegistered`, `showed`, `no_show`, etc.) so My Day stats match the "6 people registered" header.
- If the contact's outcome = `booked_intro` or `purchased`, reuse existing `BookIntroSheet` / `saveVipPurchase` flows (pre-filled from `reserved_contact_*`).

**Migration:** add `contact_outcome text`, `contact_outcome_logged_at timestamptz`, `contact_outcome_logged_by text` to `vip_sessions`.

**Coherence check after build:**
- Bama Dining May 22 with toggle on → list shows Nicole Welch + 6 members = 7 rows; header "7 people registered"; if Nicole = No-show, summary reads "X showed · Y no-show" including her.
- Toggle off → Nicole disappears from the list, counts decrement, her outcome row stays in DB (preserved, not deleted) so re-toggling restores state.
- Performance Summary card in the Scheduler tab dialog continues to use the same +1 logic — both surfaces match.

---

### 2. Giveaway entry form — per-action verification mode (checkbox vs screenshot)

**Default behavior change (per request):**
- Action 2 "Like, comment & tag a friend" → **checkbox + warning**
- Action 3 "Share to your story" → **checkbox + warning**
- Action 4 "Post a Class Story" → **checkbox + warning**
- Partner actions (Visit Hemline, Lush, Turbo, etc.) → **screenshot** (unchanged)

**Warning copy** (shown under each checkbox action):
> ⚠ We verify every entry. False check-ins disqualify your entries and ban you from future giveaways.

**Admin override (Partner Deck / Settings panel):**
- Add a "Verification Method" section listing every action (built-in + each partner) with a 2-option toggle per row: **Checkbox** or **Screenshot Upload**.
- Persists to a new JSONB column `action_verification_modes` on `giveaway_studios`, shape:
  ```json
  { "post_engagement": "checkbox", "story_share": "checkbox", "free_class": "checkbox", "partner:<uuid>": "screenshot" }
  ```
- Default when key is missing: built-in actions → `checkbox`; partner actions → `screenshot`.

**Entry form changes (`GiveawayEntryForm.tsx`):**
- Replace the three hard-coded `ScreenshotUpload` blocks (actions 2, 3, 4) with a small `<ActionVerification>` helper that renders either:
  - `ScreenshotUpload` (current behavior), or
  - A large checkbox with the verification warning underneath.
- Same helper used for each partner action.
- Submit logic: when an action is in checkbox mode and checked, set `action_*` boolean = true and leave `*_screenshot_url` = null. Server-side schema unchanged (the `_screenshot_url` columns are already nullable).

**Migration:** `ALTER TABLE giveaway_studios ADD COLUMN action_verification_modes jsonb NOT NULL DEFAULT '{}'::jsonb;`

**Coherence check after build:**
- Fresh studio (empty `action_verification_modes`) → actions 2/3/4 render as checkboxes with warning; partners render as screenshot upload.
- Admin flips action 2 to "Screenshot Upload" in Settings → form immediately shows uploader for that action only.
- Admin flips a partner to "Checkbox" → that partner card shows checkbox + warning, no screenshot required.
- Entries table / draw logic unaffected (booleans already drive eligibility; screenshot URLs were never required for the draw).

---

### Files to touch
- `src/features/myDay/VipRegistrationsSheet.tsx` (synthetic group-contact row + outcome persistence)
- `src/features/giveaway/components/GiveawayEntryForm.tsx` (verification-mode-aware rendering)
- `src/features/giveaway/components/SettingsPanel.tsx` (admin per-action mode toggles)
- `src/features/giveaway/hooks/useGiveawayStudio.ts` (expose `action_verification_modes`)
- Two new migrations:
  - `vip_sessions`: add `contact_outcome`, `contact_outcome_logged_at`, `contact_outcome_logged_by`
  - `giveaway_studios`: add `action_verification_modes jsonb default '{}'`

No changes to commission, attribution, intro pipeline, or draw logic.
