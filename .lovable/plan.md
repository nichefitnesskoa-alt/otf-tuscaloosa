## Goal
Let SAs tap a row in the "Text your sourced leads" card (My Day + Follow-Up) to drill into the full lead — name, phone, source, sourced by, notes, activity history — even though there's no booked intro yet.

## Approach
Reuse the existing `LeadDetailSheet` (already used on the Leads page) so the drilldown matches what staff see elsewhere. No new UI surface, no new data model.

## Changes

**`src/features/myDay/SourcedLeadsToText.tsx`**
- Add `detailLead` state holding the full `Tables<'leads'>` row.
- Wrap the row's name/phone area (the `flex-1 min-w-0` block) in a button that calls `setDetailLead(...)`. Text button, Call link, and kebab keep their own click handlers + `stopPropagation` so they don't trigger the drilldown.
- Fetch the full lead record on click via `supabase.from('leads').select('*').eq('id', lead.id).maybeSingle()` (the hook only selects a subset of columns; `LeadDetailSheet` expects the full row + lead_activities).
- Render `<LeadDetailSheet lead={detailLead} activities={activities} open onOpenChange ... onRefresh={notifyDataChanged(['leads','sa-leads'])} />`.
- Pull `lead_activities` with a small `useQuery(['lead_activities', detailLead.id])` scoped to the opened lead so we don't fetch the full activities table on My Day mount.

**No DB / business-logic changes.** Archive/booked/text actions stay where they are. Pure presentation: a tap on the row now opens the existing detail sheet.

## Out of scope
- No edits to `LeadDetailSheet` itself.
- No changes to the WIG tab mount (it inherits via the shared component).
- No new "drilldown" component — reusing the Leads page sheet keeps one source of truth.
