

# Fix: Pre-Intro Questionnaire Links Section Not Expanding

## Root Cause

The Radix `CollapsibleTrigger asChild` wrapping `CardHeader` creates a DOM structure conflict. The Collapsible's internal state management and the `hidden` attribute on `CollapsibleContent` are not toggling correctly, causing the content to remain hidden even when clicked.

## Solution

Replace the Radix `Collapsible` / `CollapsibleTrigger` / `CollapsibleContent` pattern with a simple manual toggle using React state. The component already has `open` / `setOpen` state -- we just need to use a plain `onClick` handler on the `CardHeader` and conditionally render the `CardContent` based on `open`, bypassing the Radix Collapsible entirely.

## Changes

### File: `src/components/PastBookingQuestionnaires.tsx`

1. Remove `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger` from imports
2. Replace the outer `<Collapsible>` wrapper with just `<Card>`
3. Replace `<CollapsibleTrigger asChild>` around `CardHeader` with a plain `CardHeader` that has `onClick={() => setOpen(!open)}`
4. Replace `<CollapsibleContent>` around `CardContent` with a simple `{open && (<CardContent>...</CardContent>)}`

No logic changes -- just swapping the Radix Collapsible for a manual show/hide that avoids the DOM nesting and state issues.

