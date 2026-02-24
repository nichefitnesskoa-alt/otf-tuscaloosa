

# Add Outcome Result Bottom Banner to Intro Cards

## Problem
When an outcome has been logged (e.g. "Booked 2nd intro", "Premier", "No-show"), the result only appears as a tiny badge in Row 2. The user wants a bold, colored, full-width banner at the bottom of the card — impossible to miss — so any SA can instantly see the outcome without clicking the Outcome button.

## Solution
Add a `StatusBanner` at the bottom of each card (after the secondary actions row, before the outcome drawer) when `item.latestRunResult` exists. Color-coded by result type:

- **Sale** (Premier, Elite, Basic, etc.): Green `#16a34a` — `✓ Purchased — {result}`
- **Booked 2nd intro**: Blue `#2563eb` — `📅 Booked 2nd Intro`
- **Didn't Buy**: Red `#dc2626` — `✗ Didn't Buy`
- **No-show**: Gray `#64748b` — `👻 No-show`
- **Other** (Follow-up needed, etc.): Amber `#d97706` — `⏳ {result}`

Also remove the copy-phone button since it's not useful.

## Changes — `src/features/myDay/IntroRowCard.tsx`

### 1. Remove copy phone button (lines 363-367)
Delete the `<Button>` that copies the phone number.

### 2. Add outcome bottom banner (after line 368, before the outcome drawer)
```tsx
{item.latestRunResult && (
  <StatusBanner
    bgColor={
      item.latestRunResult.includes('Premier') || item.latestRunResult.includes('Elite') || item.latestRunResult.includes('Basic')
        ? '#16a34a'
        : item.latestRunResult === 'Booked 2nd intro'
        ? '#2563eb'
        : item.latestRunResult === "Didn't Buy"
        ? '#dc2626'
        : item.latestRunResult === 'No-show'
        ? '#64748b'
        : '#d97706'
    }
    text={
      item.latestRunResult.includes('Premier') || item.latestRunResult.includes('Elite') || item.latestRunResult.includes('Basic')
        ? `✓ Purchased — ${item.latestRunResult}`
        : item.latestRunResult === 'Booked 2nd intro'
        ? '📅 Booked 2nd Intro'
        : item.latestRunResult === "Didn't Buy"
        ? "✗ Didn't Buy"
        : item.latestRunResult === 'No-show'
        ? '👻 No-show'
        : `⏳ ${item.latestRunResult}`
    }
  />
)}
```

This reuses the existing `StatusBanner` component already imported and used for the top Q-status banner.

## Files Changed

| File | Change |
|------|--------|
| `src/features/myDay/IntroRowCard.tsx` | Add outcome bottom banner using `StatusBanner`, remove copy-phone button |

