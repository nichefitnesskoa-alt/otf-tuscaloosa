# Own It Deck — Per-Owner Slides + Drilldowns + Leads Fix

## What changes

### 1. Fix the wrong "10 leads" number (Slide 5)

Today Slide 5 computes `totalLeads = sglFunnel.leads + nonSglFunnel.leads`, which is just intros_booked rows for the month. WIG's authoritative "39 leads" number comes from the manually-entered `monthly_lead_totals.lead_total` row for the current month, and Studio/WIG both read it that way.

Fix: `useDeckData` will load `monthly_lead_totals` for the current CT month and expose `studioLeadsTotal`. Slide 5 will use that as the hero number. The SGL/Non-SGL split stays as a secondary breakdown (intros_booked only), clearly labeled "Booked intros: SGL vs Non-SGL" so the two concepts never get confused again.

### 2. One slide per owner (replaces Slide 9 aggregate)

Slide 9 today crams up to 12 owners into a 2-column grid. It'll become one slide per active owner, ordered **submitted first, then not-submitted**, alphabetical within each group (matches Slide 9's current sort).

Each owner slide shows every field on `table_owner_entries` for the current meeting:

- Header: owner name (huge), lane, status pill (Locked in / Not submitted), submitted-at time
- Prior week block: `prior_status` (kept/broken chip), `prior_result`, `prior_learning`
- Last week update: `last_week_update`
- This week focus: `this_week_focus`
- Commitment (largest block, hero of the slide): `commitment` + `serves_wig` line
- Ideas / Ask: `ideas`, `ask` (only rendered if present)
- Footer: their open action items count + list (from `table_action_items` filtered by `owner_staff_id`)

If an owner has no entry at all, the slide is a bold "Not submitted" card with the last commitment they made (looked up from the prior meeting's entry, so the room can hold them to it).

### 3. Deeper detail on the existing metric slides

Every stat slide gets a second tier of detail so nothing on screen is a mystery number.

- **Slide 1 Net Gain** — add: pending churns list (member + date), sales-needed-by-EOM breakdown, delta vs goal in members and % pace.
- **Slide 2 SGL funnel / Slide 3 Non-SGL funnel** — add per-source rows (top 5 lead sources contributing) and the booked→showed and showed→sold conversion rates as small numbers under each stage.
- **Slide 4 SOML** — add per-SA table: name, on-pace/behind, sourced count vs goal, last update timestamp.
- **Slide 5 Studio Leads** — corrected hero number (see above); add: pace vs today's target, projected EOM, and top-3 lead sources this month.
- **Slide 6 Coach Close %** — add overall run/sales counts, goal delta, weekly trend if available.
- **Slide 7 Individual Coach Stats** — expanded per-coach table: runs, sales, close %, 1st vs 2nd split, avg intros/day.
- **Slide 8 Action Items** — group by owner, show due date + status pill, past-due highlighted red.

Where a slide would overflow at 32px body, use the deck's typography scale (24-32px body, 22px caption) and keep the density budget from the slides-app playbook — split into two slides rather than shrink text below 22px.

### 4. Drilldown overlays (click any stat + D key)

New component `DrillOverlay.tsx` — full-canvas overlay inside the 1920×1080 slide, dark backdrop, close on click or Esc.

Each slide exports an optional `drill: () => ReactNode` prop consumed by `OwnItDeckPage`. Two ways to open:

- **Click**: big stat numbers become buttons that call `openDrill(<StatDrillPanel …/>)`.
- **Keyboard D**: opens the slide's default drill (usually the underlying row list — bookings, runs, owners, action items).

Drill contents per slide:

- Net Gain → full pending churns list + recent applied churns
- SGL / Non-SGL funnel → the booking rows behind each stage (name, coach, date, source, booking_status_canon)
- Studio Leads → the `leads` rows for the month (name, source, created_at)
- SOML → the SA×row grid with sourced counts
- Coach Close → per-coach ran-vs-sold rows (first intros only)
- Individual Coach Stats → same, expanded
- Action Items → grouped by owner with descriptions
- Owner slides → response history (`table_responses` for that owner_entry_id)

Drill overlays keep the scaled-slide typography (24-28px body) so they stay readable projected.

## Technical details

**New/edited files**

- `src/features/ownItDeck/useDeckData.ts` — add `studioLeadsTotal` (from `monthly_lead_totals`), `topLeadSources` (top 5 `lead_source` counts from `leads` this month), `perSaSoml`, `perCoachDetail`, `pendingChurns`, `ownersWithDetail` (join `table_owner_entries` full record + prior meeting's commitment fallback + per-owner open action items).
- `src/features/ownItDeck/DrillOverlay.tsx` — new. Portal-style absolute overlay inside the 1920×1080 canvas, dark backdrop, close button + Esc handler.
- `src/features/ownItDeck/slides/SlideOwner.tsx` — new. One-owner slide component.
- `src/features/ownItDeck/OwnItDeckPage.tsx` — build slides array dynamically: 8 metric slides + N owner slides (submitted first, then not). Add D-key handler + `openDrill(node)` context. Update slide-count in URL/title.
- Existing slide components (`Slide01NetGain`, `FunnelSlide`, `Slide04Soml`, `Slide05WigLeads`, `Slide06CoachClose`, `Slide07CoachStats`, `Slide08ActionItems`) — add secondary detail sections and wire up `drill` output. Delete `Slide09OwnerCommitments.tsx` (replaced by per-owner slides).

**Data queries added to `useDeckData`**

```ts
// monthly_lead_totals for hero leads number
supabase.from('monthly_lead_totals').select('lead_total').eq('month_year', monthKey).maybeSingle()

// top lead sources
supabase.from('leads').select('source, created_at')
  .gte('created_at', `${startYMD}T00:00:00`).lte('created_at', `${endYMD}T23:59:59`)

// prior meeting commitment fallback for not-submitted owners
supabase.from('table_owner_entries').select('owner_id, commitment')
  .eq('meeting_id', priorMeetingId)

// per-owner open action items
already loaded — just group by owner_staff_id
```

**Consumer/coherence check**

- Studio Leads hero on Slide 5 will match WIG's studio-leads hero (both read `monthly_lead_totals`).
- SGL/Non-SGL leads on Slides 2/3 continue to mean "booked intros classified as SGL/Non-SGL", which is what the funnel is measuring — but Slide 5's headline no longer conflates the two.
- Per-owner action item count matches `TheTable.tsx` action items tab for that owner.
- Owner slide order (submitted-first) matches Slide 9's current sort, so no owner appears in a surprising position.

**Out of scope**

- Editing owner commitments from inside the deck.
- Downloadable .pptx.
- Persisted "presenter mode" cursor sync across devices.
