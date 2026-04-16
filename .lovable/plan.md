## Plan: Refine VIP Session Display on My Day

### What changes

1. **Remove "Estimated Size" field** from the expanded VIP session card
2. **Make "X registered" tappable** — opens a detail view showing every registered member with their full registration form details (name, phone, email, biometrics, waiver status, etc.)
3. **Stop counting VIP sessions as intros** in the day header — "3 intros" should only count true (non-VIP) intros. VIP groups remain visible as separate cards but don't inflate intro counts

### Files to change

`**src/features/myDay/IntroDayGroup.tsx**` (or wherever the day header count is computed)

- Filter out items where `isVipSession === true` when computing the `intros` count and Q% denominator
- VIP cards still render in the list, just not counted

`**src/features/myDay/IntroRowCard.tsx**` (VIP session card section)

- Remove the "Estimated Size" field from the expanded view
- Convert the "X registered" line into a tappable button that opens a registrations sheet
- Keep Group, Date & Time, Group Contact fields

**New component: `src/features/myDay/VipRegistrationsSheet.tsx**`

- Sheet/drawer that fetches `vip_registrations` for the given `vip_session_id`
- Displays each registrant's full form data: name, phone, email, emergency contact, DOB/age, waiver acceptance, any biometrics or notes captured during registration
- Read-only view — staff can see who registered and contact them

### Downstream effects

- **Day header count** ("3 intros") → will correctly show only true intros (excludes VIP groups)
- **Q% calculation** in header →

&nbsp;

I need to be able to choose an outcome from each person in the registration detailed expansion list