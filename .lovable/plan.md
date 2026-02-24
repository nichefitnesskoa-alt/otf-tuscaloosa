

# Pre-populate Outcome Drawer with Previously Saved Data

## Problem
When reopening the Outcome Drawer (e.g., by tapping the outcome badge), the "2nd Intro Details" fields (Date, Time, Coach) appear blank even though a 2nd intro was already booked. The user expects to see the previously submitted values pre-filled so they can make edits from that baseline.

## Root Cause
In `OutcomeDrawer.tsx`, the linked 2nd intro data is fetched (lines 109-128) and displayed as a read-only info banner, but the form fields (`secondIntroDate`, `secondIntroTime`, `secondIntroCoach`) are initialized to empty strings/undefined (lines 101-103). There is no `useEffect` that populates these form fields when `linkedSecondIntro` loads.

## Changes — `src/components/myday/OutcomeDrawer.tsx`

### 1. Pre-populate 2nd intro form fields from linked data
Add a `useEffect` after the `linkedSecondIntro` fetch effect (after line 128) that sets `secondIntroDate`, `secondIntroTime`, and `secondIntroCoach` when `linkedSecondIntro` is loaded:

```tsx
useEffect(() => {
  if (!linkedSecondIntro) return;
  if (linkedSecondIntro.date) {
    setSecondIntroDate(new Date(linkedSecondIntro.date + 'T00:00:00'));
  }
  if (linkedSecondIntro.time) setSecondIntroTime(linkedSecondIntro.time);
  if (linkedSecondIntro.coach) setSecondIntroCoach(linkedSecondIntro.coach);
}, [linkedSecondIntro]);
```

This ensures that when an SA taps the outcome badge to edit a "Booked 2nd intro" outcome, the date, time, and coach fields are already filled with the previously saved values. The SA can then modify any field and re-save.

## Files Changed

| File | Change |
|------|--------|
| `src/components/myday/OutcomeDrawer.tsx` | Add useEffect to populate 2nd intro form fields from `linkedSecondIntro` |

