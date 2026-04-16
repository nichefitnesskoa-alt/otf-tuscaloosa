
Make all displayed phone numbers tappable so they open the device's default SMS app (iOS Messages / Android Messaging).

## Approach
Wrap phone number text in `<a href="sms:+1XXXXXXXXXX">` links. The `sms:` URI scheme is universally supported on iOS and Android — it opens the default messaging app pre-addressed to that number. On desktop it's a no-op (or opens the OS handler), which is fine.

## Pattern
```tsx
<a href={`sms:+1${cleanPhone}`} className="underline hover:text-primary">
  {formatPhoneDisplay(phone)}
</a>
```
- Use `stripCountryCode()` from `src/lib/parsing/phone.ts` to get the 10-digit value
- Prefix with `+1` for E.164 formatting (most reliable across both platforms)
- Use `formatPhoneDisplay()` for the visible text `(205) 555-1234`
- `e.stopPropagation()` on click so tapping the number inside an expandable card doesn't toggle the card

## Files to change (every place a phone number is rendered as text)
1. `src/features/myDay/IntroRowCard.tsx` — phone shown on intro cards
2. `src/features/followUp/CoachFollowUpList.tsx` — phone in `introDateLabel · SA · phone` line
3. `src/features/followUp/FollowUpList.tsx` — same pattern (SA queue)
4. `src/features/myDay/NewLeadsAlert.tsx` — new lead phone display
5. `src/features/pipeline/components/PipelineRowCard.tsx` and `PipelineTable.tsx` — pipeline phone columns
6. `src/components/leads/LeadCard.tsx` and `LeadDetailSheet.tsx` — lead phone
7. `src/components/dashboard/ClientProfileSheet.tsx` — client profile phone
8. `src/features/myDay/VipRegistrationsSheet.tsx` — registrant phone (just added)
9. `src/components/myday/MyDayIntroCard.tsx` — coach card phone
10. Any other component surfaced via `code--search_files` for `formatPhoneDisplay` / `stripCountryCode` / phone rendering

I'll do a full search before building so no rendered phone gets missed.

## Behavior preserved
- Existing "Copy Phone" buttons stay (some users want to paste into other tools)
- Cards don't expand/collapse when the link is tapped (stopPropagation)
- Invalid/null phones render as plain text (no link)
- Visual: subtle underline + orange on hover so it's clearly tappable per UI standard

## Downstream effects
- None to data, metrics, or attribution — purely a presentational/affordance change
- No DB, no role changes, no realtime impact
