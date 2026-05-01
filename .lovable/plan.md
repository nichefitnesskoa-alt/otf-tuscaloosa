## What we're changing

1. **Remove Deploy 5 lead measure** from WIG (and the supporting UI section).
2. **Make POS Referral Ask easier to complete and track.** Today the only way `coach_referral_asked = true` gets set is from the coach's pre/post panel. SAs have no obvious place to confirm "yes I asked the new member for referrals at point-of-sale." We'll add a **Closed Memberships → Referral Ask tracker** on the WIG page that lists every membership sale in the selected date range and lets the SA mark each one:
   - **Asked at POS** (done in the moment), or
   - **Will follow up** (text/in-person later), with a one-tap completion when done.

This gives a visible queue of "you sold a membership but haven't asked for a referral yet" — exactly the prompt the user described.

---

## 1. Remove Deploy 5

### `src/pages/Wig.tsx`
- Remove the `deployRes` query and the `deploys` aggregation in `loadLeadMeasures`.
- Remove the `Team Deploy Activations` progress bar block (the "X / 5" bar above the SA table).
- Remove the **Deploys** column from the SA Lead Measures table (header + cell).
- Remove the `totalTeamDeploys` calculation.
- **Keep** `MilestonesDeploySection` mounted on WIG for now (it still tracks Celebrations and 5-class packs, which are referenced by other lead measures). We'll just hide the Deploy tab inside it (next step) so nothing here references "Deploy 5" as a measure.

### `src/components/dashboard/MilestonesDeploySection.tsx`
- Remove the **Deploy** tab (`TabsTrigger value="deploy"` and `TabsContent value="deploy"`).
- Remove the `Members deployed` summary stat.
- Remove the `deploys` state, `loadDeploys` query, `handleDeploySubmit`, `toggleDeployConverted`, and Deploy edit branch.
- Keep Celebrations and the 5-class pack flow untouched.

### Data
- No DB migration. The `milestones` table keeps `entry_type = 'deploy'` rows for historical reporting, we just stop reading/writing them from the app.

---

## 2. New: Closed Memberships → Referral Ask tracker (WIG)

A new card on WIG, between **SA Lead Measures** and **Coach Lead Measures**.

### Data source
- Use the already-loaded `introsRun` from `DataContext` (no new fetch).
- Filter: `isMembershipSale(result)` AND `buy_date` (or run_date fallback) within the WIG date range.
- Join to the booking via `linked_intro_booked_id` to read `member_name`, `intro_owner` (the SA who gets credit), and `coach_referral_asked`.

### UI (per row)
```
[Member name] · sold by [intro_owner] · [date]
  Status: [● Asked at POS] [○ Need to follow up] [✓ Done — asked later]
```

- If `coach_referral_asked = true` → row collapses with a small "✓ Asked" badge and is hidden by default behind a "Show completed" toggle.
- If false → three buttons:
  1. **Asked at POS** → sets `coach_referral_asked = true`, `last_edited_by = current user`, `edit_reason = 'POS referral ask logged on WIG'`.
  2. **Will follow up** → sets a new flag `referral_ask_followup_pending = true` (see DB section). Row stays visible with an amber "Follow up pending" badge.
  3. **Done — asked later** → same effect as "Asked at POS" plus clears the pending flag. Used when the SA texts/asks in person later.

### Empty state
"No membership sales in this period — nothing to ask about yet."

### Why this works for the user's ask
- The SA sees every closed membership the moment they open WIG — that's the "pops up when a closed membership happens" behavior.
- They can confirm in the moment (POS) or defer ("ask later via text/in person") and the row stays in their face until completed.

---

## 3. DB change

One small additive column on `intros_booked`:

```
ALTER TABLE intros_booked
  ADD COLUMN referral_ask_followup_pending boolean NOT NULL DEFAULT false;
```

- No data migration needed; defaults to false.
- No RLS changes (existing public policies cover it).
- No trigger changes.

---

## 4. Tone / copy (per project rules)

- Card title: **"Ask for a referral"**
- Subtitle: **"Every new member from this period. Tap once you've asked."**
- Buttons: **"Asked at POS"** · **"Ask later"** · **"Done"** (no jargon)

---

## Files I will change

- `src/pages/Wig.tsx` — remove Deploy 5 measure, add the referral-ask tracker card.
- `src/components/dashboard/MilestonesDeploySection.tsx` — remove the Deploy tab/state/handlers.
- New migration adding `referral_ask_followup_pending` to `intros_booked`.

## Files I will NOT change

- `coach_referral_asked` semantics (still the source of truth for "was a referral ask made").
- Coach pre/post panel — still toggles the same field.
- Any commission / scoreboard / reporting logic.
- Other pages (My Day, Coach View, Pipeline) — no UI changes.

## Open question (only if you want to answer — otherwise I'll default)

Default I'll pick: the new tracker card is visible to **SAs and Admin** on WIG (Coaches don't need it). Tell me if you'd rather show it to coaches too.
