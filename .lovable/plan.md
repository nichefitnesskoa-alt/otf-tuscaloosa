The problem was sophie marshall paleyo was the organizer for what was Pi Phi.. So why did she show up under PJs coffee when Instagram DMs was the main contact there? That needs to be investigated and fixed as well. After that then build everything you have listed as well

  
  
Root cause

`VipRegistrationsSheet` (the "View registrants & log outcomes" sheet on My Day) loads **all** rows from `vip_registrations` for the session, including the group contact (the person who reserved the slot — e.g. Sophie Marshall reserving for Phi Gam). Everywhere else in the app — Pipeline scheduler card, member count, CSV export, performance show-rate denominator — explicitly filters with `.eq('is_group_contact', false)`. The My Day sheet is the only place that doesn't, which is why a non-attendee organizer appears at the top with an outcome dropdown.

The user's rule: group contacts are organizers, not attendees. Only people who explicitly self-register through the member form count as registered.

## Fix

`**src/features/myDay/VipRegistrationsSheet.tsx**`

1. Add `.eq('is_group_contact', false)` to the registrations query (line 97-100), matching the pattern in `VipSchedulerTab.tsx` and `VipPipelineTable.tsx`.
2. Remove the now-unreachable `is_group_contact` ordering (it'll all be false) and remove the amber "Group Contact" badge UI block (line 318-322) since no group-contact rows will ever render here.
3. Remove the unused `Star` icon import.

The header count (`{regs.length} registered`) will now correctly show only true member registrations, matching the count shown in the Pipeline scheduler and on the VIP card.

## Files changed

- `src/features/myDay/VipRegistrationsSheet.tsx` — filter out group contacts; remove dead Group Contact badge + Star import

## Files audited, no change needed

- `src/features/pipeline/components/VipSchedulerTab.tsx` — already filters correctly
- `src/features/pipeline/components/VipPipelineTable.tsx` — already filters correctly
- `src/pages/VipMemberRegister.tsx` — correctly inserts members with `is_group_contact: false`
- `src/pages/VipAvailability.tsx` — correctly inserts the organizer with `is_group_contact: true`
- DB schema unchanged; no migration needed

## Downstream effects

- Sophie Marshall (and any other organizer) disappears from the My Day registrant outcome list — matches Pipeline behavior
- "16 registered" header on the sheet drops to the true member count (matches the Pipeline card's count)
- No effect on VIP scheduler, registration flow, CSV export, or performance metrics — they already excluded organizers
- No effect on intro booking flow inside the sheet — friend logic and `vip_session_id` attribution untouched
- No DB / RLS / migration changes

## Confirm before building

None — the rule ("group contacts are organizers, not attendees, exclude them from the registrant list") is already canon everywhere except this one component.  
  
  
